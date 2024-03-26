import { Router, getExpressRouter } from "./framework/router";

import { WebSession, User, Post, Comment, Karma, PostVotes, CommentVotes, Favorite, Hide, Flag } from "./app";
import { WebSessionDoc } from "./concepts/websession";
import { ObjectId } from "mongodb";

class Routes {
  // Register a new user and log in
  @Router.post("/register")
  async createUser(session: WebSessionDoc, username: string, password: string) {
    WebSession.assertLoggedOut(session);
    const { msg, user } = await User.create(username, password);
    await Karma.increase(user._id, 1);
    WebSession.start(session, user._id);
    return { msg };
  }

  // Log out current user
  @Router.post("/logout")
  async logoutUser(session: WebSessionDoc) {
    WebSession.end(session);
    return { msg: "Logged out successfully." };
  }

  // Return currently logged in user and their karma points
  @Router.get("/session")
  async getSessionUserKarma(session: WebSessionDoc) {
    WebSession.assertLoggedIn(session);
    const userId = WebSession.getUser(session);

    const user = await User.getById(userId);
    const karma = await Karma.get(userId);

    return { ...user, karma };
  }

  // Returns the requested user and their karma, except their email and topbar color unless it's the logged in user.
  @Router.get("/users")
  async getUser(session: WebSessionDoc, username: string) {
    const user = await User.getByUsername(username);
    const karma = await Karma.get(user._id);

    const result = { ...user, karma };

    const loggedInUserId = WebSession.getUser(session);
    if (!loggedInUserId || !loggedInUserId.equals(user._id)) {
      delete result.email;
      delete result.topBarColor;
    }

    return result;
  }

  // Update bio and email
  @Router.put("/users")
  async updateUser(session: WebSessionDoc, email: string, bio: string) {
    WebSession.assertLoggedIn(session);
    const user = WebSession.getUser(session);
    return await User.update(user, email, bio);
  }

  // Create a post and automatically upvote it. Does not affect user karma.
  @Router.post("/posts")
  async createAndUpvotePost(session: WebSessionDoc, title: string, url: string, text: string) {
    WebSession.assertLoggedIn(session);
    const userId = WebSession.getUser(session);
    const post = await Post.create(userId, title, url, text);
    await PostVotes.upvote(userId, post._id);
    return post;
  }

  // Change a user's password
  @Router.post("/password")
  async changePassword(session: WebSessionDoc, oldPassword: string, newPassword: string) {
    WebSession.assertLoggedIn(session);
    const userId = WebSession.getUser(session);
    return await User.changePassword(userId, oldPassword, newPassword);
  }

  // User login
  @Router.post("/login")
  async loginUser(session: WebSessionDoc, username: string, password: string) {
    const { msg, _id } = await User.authenticate(username, password);
    WebSession.start(session, _id);
    return { msg };
  }

  // Vote a post, either upvote or unvote. Affects karma by 1 if upvoted.
  @Router.post("/posts/:id/vote")
  async votePost(session: WebSessionDoc, _id: string, voteType: "up" | "unvote") {
    WebSession.assertLoggedIn(session);
    const userId = WebSession.getUser(session);
    const postId = new ObjectId(_id);

    const post = await Post.getById(postId);
    if (post.author.equals(userId)) {
      throw new Error("Cannot vote on your own post.");
    }

    const existingVote = await PostVotes.getVote(userId, postId);

    if (voteType === "up" && existingVote) {
      throw new Error("Already voted.");
    }

    if (voteType === "up") {
      await PostVotes.upvote(userId, postId);
      await Karma.increase(post.author, 1);
    } else if (voteType === "unvote" && existingVote) {
      await PostVotes.unvote(userId, postId);
      if (existingVote.type === "up") {
        await Karma.decrease(post.author, 1);
      }
    } else {
      throw new Error("Invalid vote type or no vote to remove.");
    }

    return { msg: `Successfully ${voteType === "up" ? "upvoted" : "unvoted"} the post.` };
  }

  // Get recent posts with additional details
  @Router.get("/posts/recent/")
  async getRecentPosts(session: WebSessionDoc, count: string, page: string, prefix: string) {
    const user = WebSession.getUser(session);
    const options: GetPostsOptions = {
      count: parseInt(count) || 30,
      page: parseInt(page) || 1,
      titlePrefix: prefix || undefined,
    };
    const posts = await Post.get(options);
    const postIds = posts.map((post) => post._id);
    const authorIds = [...new Set(posts.map((post) => post.author))];

    // Retrieve additional information in parallel
    const [postPoints, commentCounts, authorsProfiles, userVotes] = await Promise.all([
      PostVotes.getItemsPts(postIds),
      Comment.countByRoots(postIds),
      User.getByIds(authorIds),
      user ? PostVotes.getVotes(new ObjectId(user), postIds) : Promise.resolve({}),
    ]);

    // Filter out hidden posts for the logged-in user
    const hiddenPosts = user ? await Hide.getByUser(new ObjectId(user)) : [];
    const hiddenPostIds = new Set(hiddenPosts.map((hp) => hp.item.toString()));

    // Assemble the final post list with additional details
    const results = posts
      .filter((post) => !hiddenPostIds.has(post._id.toString()))
      .map((post, index) => ({
        ...post,
        points: postPoints[post._id.toString()] || 0,
        comments: commentCounts[post._id.toString()] || 0,
        author: authorsProfiles[post.author.toString()],
        hidden: hiddenPostIds.has(post._id.toString()),
        voted: !!userVotes[post._id.toString()],
        index: index + 1 + (options.page - 1) * options.count,
      }));

    return results;
  }

  // Favorite a post
  @Router.post("/posts/:id/favorite")
  async favoritePost(session: WebSessionDoc, id: string) {
    WebSession.assertLoggedIn(session);
    const user = WebSession.getUser(session);
    return await Favorite.mark(new ObjectId(user), new ObjectId(id));
  }

  // Delete a post but only if it has no comments under it
  @Router.delete("/posts/:id")
  async deletePost(session: WebSessionDoc, _id: string) {
    WebSession.assertLoggedIn(session);
    const objectId = new ObjectId(_id);
    const userId = WebSession.getUser(session);

    const comments = await Comment.getByParent(objectId);
    if (comments.length > 0) {
      throw new Error("Cannot delete a post that has comments");
    }

    return await Post.delete(objectId, userId);
  }

  // Get post details including post points, comments, author profile, voting, hidden, favorited, flagged status by logged in user.
  @Router.get("/posts/:id")
  async getPostDetails(session: WebSessionDoc, id: string) {
    const userId = WebSession.getUser(session);
    const postId = new ObjectId(id);

    const post = await Post.getById(postId);
    const points = await PostVotes.getItemPts(postId);
    const authorProfile = await User.getById(post.author);
    const comments = await Comment.countByRoots([postId]);

    const userVote = userId ? await PostVotes.getVote(new ObjectId(userId), postId) : null;
    const userHideStatus = userId ? await Hide.isMarked(new ObjectId(userId), postId) : false;
    const userFavorited = userId ? await Favorite.isMarked(new ObjectId(userId), postId) : false;
    const userFlagged = userId ? await Flag.isMarked(new ObjectId(userId), postId) : false;

    return {
      ...post,
      points,
      author: authorProfile,
      voted: !!userVote,
      hidden: userHideStatus,
      favorited: userFavorited,
      flagged: userFlagged,
      comments: comments[postId.toString()] || 0,
    };
  }

  // Get posts with optional filtering, sorting by a customized score formula, and additional data like comments count and user votes.
  @Router.get("/posts")
  async getPosts(session: WebSessionDoc, count: string, page: string, prefix: string, date: string) {
    const _count = parseInt(count) || 30;
    const _page = parseInt(page) || 1;
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const options = {
      dateStart: fourDaysAgo,
      titlePrefix: prefix,
    };
    if (date) {
      options.dateStart = new Date(date);
      options.dateEnd = new Date(date + "T23:59:59.999Z");
    }
    const posts = await Post.get(options);
    const userIds = posts.map((post) => post.author);
    const usersProfiles = await User.getByIds(userIds);
    const postIds = posts.map((post) => post._id);
    const commentsCount = await Comment.countByRoots(postIds);
    const points = await PostVotes.getItemsPts(postIds);
    const flags = await Flag.getByItems(postIds);
    const hiddenPosts = await Hide.getByUser(WebSession.getUser(session));
    const hiddenPostIds = new Set(hiddenPosts.map((mark) => mark.item.toString()));
    const filteredPosts = posts.filter((post) => !hiddenPostIds.has(post._id.toString()));

    let userVotes = {};
    if (WebSession.getUser(session)) {
      userVotes = await PostVotes.getVotes(WebSession.getUser(session), postIds);
    }

    const result = filteredPosts
      .map((post) => {
        const postIdStr = post._id.toString();
        const hoursSinceCreation = Math.max((new Date() - post.dateCreated) / 36e5, 1);
        const score = (points[postIdStr] || 0 - 1) / hoursSinceCreation ** 1.8 - 5 * (flags[postIdStr]?.length || 0);
        return {
          ...post,
          author: usersProfiles[post.author.toString()],
          points: points[postIdStr] || 0,
          comments: commentsCount[postIdStr] || 0,
          voted: !!userVotes[postIdStr],
          hidden: hiddenPostIds.has(postIdStr),
          score,
        };
      })
      .sort((a, b) => b.score - a.score); // Sorting by score calculated from the provided formula.

    return result.slice((_page - 1) * _count, _page * _count).map((post, index) => {
      delete post.score;
      post.index = index + 1 + (_page - 1) * _count;
      return post;
    });
  }

  // Edit a post
  @Router.put("/posts/:id")
  async editPost(session: WebSessionDoc, _id: string, title: string, url: string, text: string) {
    WebSession.assertLoggedIn(session);
    const userId = WebSession.getUser(session);
    return await Post.update(new ObjectId(_id), userId, title, url, text);
  }

  // Unhide the post
  @Router.delete("/posts/:id/hide")
  async unhidePost(session: WebSessionDoc, id: string) {
    WebSession.assertLoggedIn(session);
    const user = WebSession.getUser(session);
    return await Hide.unmark(user, new ObjectId(id));
  }

  // Unfavorite the post
  @Router.delete("/posts/:id/favorite")
  async unfavoritePost(session: WebSessionDoc, id: string) {
    WebSession.assertLoggedIn(session);
    const userId = WebSession.getUser(session);
    await Favorite.unmark(new ObjectId(userId), new ObjectId(id));
    return { msg: "Post unfavorited successfully." };
  }

  // Unflag a post
  @Router.delete("/posts/:id/flag")
  async unflagPost(session: WebSessionDoc, id: string) {
    WebSession.assertLoggedIn(session);
    const user = WebSession.getUser(session);
    return await Flag.unmark(user, new ObjectId(id));
  }

  // Get favorited posts by user id including post points, number of comments, author profile, and voting status by logged in user
  @Router.get("/favorites")
  async getFavoritedPosts(session: WebSessionDoc, id: string) {
    const objectId = new ObjectId(id);
    const currentUserId = WebSession.getUser(session);
    const marks = await Favorite.getByUser(objectId);
    const postIds = marks.map((mark) => mark.item);
    const posts = await Post.getByIds(postIds);
    const authorIds = [...new Set(Object.values(posts).map((post) => post.author))];
    const authors = await User.getByIds(authorIds);
    const commentsCount = await Comment.countByRoots(postIds);
    let votes = {};
    if (currentUserId) {
      votes = await PostVotes.getVotes(currentUserId, postIds);
    }
    const postsPoints = await PostVotes.getItemsPts(postIds);

    return postIds.map((postId, index) => ({
      ...posts[postId.toString()],
      index: index + 1,
      points: postsPoints[postId.toString()],
      comments: commentsCount[postId.toString()] || 0,
      author: authors[posts[postId.toString()].author.toString()],
      voted: votes[postId.toString()] ? votes[postId.toString()].type : undefined,
    }));
  }

  // Hide the post
  @Router.post("/posts/:id/hide")
  async hidePost(session: WebSessionDoc, id: string) {
    WebSession.assertLoggedIn(session);
    const user = WebSession.getUser(session);
    return await Hide.mark(user, new ObjectId(id));
  }

  // Flag a post, requires 5 karma.
  @Router.post("/posts/:id/flag")
  async flagPost(session: WebSessionDoc, id: string) {
    const user = WebSession.getUser(session);
    WebSession.assertLoggedIn(session);
    await Karma.isAllowed(user, 5);
    return await Flag.mark(user, new ObjectId(id));
  }

  // Get hidden posts for the logged in user, including post points, number of comments, author's user profile, and current user's vote status
  @Router.get("/hidden")
  async getHiddenPosts(session: WebSessionDoc) {
    WebSession.assertLoggedIn(session);

    const userId = WebSession.getUser(session);
    const hiddenMarks = await Hide.getByUser(userId);

    const postIds = hiddenMarks.map((mark) => mark.item);
    const hiddenPosts = await Post.getByIds(postIds);
    const postPoints = await PostVotes.getItemsPts(postIds);
    const commentCounts = await Comment.countByRoots(postIds);

    const authorIds = Object.values(hiddenPosts).map((post) => post.author);
    const authorProfiles = await User.getByIds(authorIds);

    const userVotes = await PostVotes.getVotes(userId, postIds);

    // Construct the response
    return postIds.map((postId, index) => {
      const postIdStr = postId.toString();
      const post = hiddenPosts[postIdStr];
      const authorProfile = authorProfiles[post.author.toString()];

      return {
        ...post,
        index: index + 1,
        points: postPoints[postIdStr],
        comments: commentCounts[postIdStr] || 0,
        author: authorProfile,
        voted: userVotes[postIdStr] || null,
      };
    });
  }

  // Make a comment and upvote it
  @Router.post("/comments")
  async createCommentAndUpvote(session: WebSessionDoc, content: string, parent: string) {
    WebSession.assertLoggedIn(session);
    const user = WebSession.getUser(session);
    if (!user) throw new Error("User must be logged in to make a comment");
    const comment = await Comment.create(new ObjectId(user), content, new ObjectId(parent));
    await CommentVotes.upvote(new ObjectId(user), comment._id);
    return comment;
  }

  // Get comment details including author profile and voting status of logged in user.
  @Router.get("/comments/:id")
  async getCommentWithDetails(id: string, session: WebSessionDoc) {
    const commentId = new ObjectId(id);
    // Get the main comment
    const comment = await Comment.getById(commentId);
    // Get author's profile
    const authorProfile = await User.getById(comment.author);
    // Check if logged in and if the user has voted on the comment
    const userId = WebSession.getUser(session);
    let userVote = null;
    if (userId) {
      userVote = await CommentVotes.getVote(userId, commentId);
    }

    return {
      ...comment,
      author: authorProfile,
      vote: userVote ? userVote.type : null,
    };
  }

  // Edit a comment
  @Router.put("/comments/:id")
  async updateComment(session: WebSessionDoc, _id: string, content: string) {
    WebSession.assertLoggedIn(session);
    const userId = WebSession.getUser(session);
    if (!(await Comment.isUserAuthor(new ObjectId(_id), userId))) {
      throw new Error("User is not the author of this comment.");
    }
    return await Comment.update(new ObjectId(_id), content);
  }

  // Delete a comment, but not allowed if it has comments under it.
  @Router.delete("/comments/:id")
  async deleteComment(session: WebSessionDoc, _id: string) {
    WebSession.assertLoggedIn(session);
    const user = WebSession.getUser(session);
    const commentId = new ObjectId(_id);
    const comment = await Comment.getById(commentId);
    if (!user.equals(comment.author)) {
      throw new Error("Not the author of the comment");
    }
    return await Comment.delete(commentId);
  }

  // Vote the comment (upvote, downvote, or unvote). Cannot vote self-comment. Affect karma of voted user by 1. Downvote requires 6 karma.
  @Router.post("/comments/:id/vote")
  async voteComment(session: WebSessionDoc, _id: string, voteType: string) {
    WebSession.assertLoggedIn(session);

    const userId = WebSession.getUser(session);
    const commentAuthorId = await Comment.getById(new ObjectId(_id)).then((comment) => comment.author);

    if (userId.equals(commentAuthorId)) {
      throw new Error("Cannot vote on own comment.");
    }

    switch (voteType) {
      case "upvote":
        await CommentVotes.upvote(userId, new ObjectId(_id));
        await Karma.increase(commentAuthorId, 1);
        break;
      case "downvote":
        await Karma.isAllowed(userId, 6);
        await CommentVotes.downvote(userId, new ObjectId(_id));
        await Karma.decrease(commentAuthorId, 1);
        break;
      case "unvote":
        await CommentVotes.unvote(userId, new ObjectId(_id));
        break;
      default:
        throw new Error("Invalid vote type.");
    }

    return { msg: `Comment ${voteType}d successfully.` };
  }

  // Change top bar color, requires 2 karma
  @Router.put("/topbar")
  async changeTopBarColor(session: WebSessionDoc, topBarColor: string) {
    WebSession.assertLoggedIn(session);
    const userId = WebSession.getUser(session);
    await Karma.isAllowed(new ObjectId(userId), 2);
    return await User.changeTopBar(userId, topBarColor);
  }
}

export default getExpressRouter(new Routes());
