import { Router, getExpressRouter } from "./framework/router";

import { WebSession, Post, Upvote, Comment, Favorite } from "./app";
import { WebSessionDoc } from "./concepts/websession";
import { ObjectId } from "mongodb";

class Routes {
  // Get the current username from session
  @Router.get("/session")
  async getCurrentUsername(session: WebSessionDoc) {
    return { username: WebSession.getUser(session) };
  }

  // Login: Given a username, start the web session with that username
  @Router.post("/login")
  async loginUser(session: WebSessionDoc, username: string) {
    WebSession.start(session, username);
    return { msg: "Session started with " + username };
  }

  // Create a new post with given content by the logged-in user
  @Router.post("/posts")
  async createPost(session: WebSessionDoc, content: string) {
    const username = WebSession.getUser(session);
    return await Post.createPost(username, content);
  }

  // Route to get all posts
  @Router.get("/posts")
  async getAllPosts() {
    return await Post.getPosts();
  }

  // Get posts by a given author
  @Router.get("/posts")
  async getPostsByAuthor(author: string) {
    return await Post.getPostsByAuthor(author);
  }

  // Upvote a post
  @Router.post("/posts/:_id/upvote")
  async upvotePost(session: WebSessionDoc, _id: string) {
    WebSession.isLoggedIn(session);
    const username = WebSession.getUser(session);
    return await Upvote.upvote(username, new ObjectId(_id));
  }

  // Remove an upvote from a post
  @Router.delete("/posts/:_id/upvote")
  async removeUpvoteFromPost(session: WebSessionDoc, _id: string) {
    const username = WebSession.getUser(session);
    return await Upvote.removeUpvote(username, new ObjectId(_id));
  }

  // Get array of users who upvoted a post
  @Router.get("/posts/:_id/upvotes")
  async getUsersWhoUpvotedForPost(_id: string) {
    const itemId = new ObjectId(_id);
    return await Upvote.getUsersWhoUpvoted(itemId);
  }

  // Log out user
  @Router.post("/logout")
  async logOutUser(session: WebSessionDoc) {
    WebSession.end(session);
    return { message: "Logged out successfully." };
  }

  // Get comments for a specific post by postId
  @Router.get("/comments/:postId")
  async getCommentsForPost(session: WebSessionDoc, postId: string) {
    WebSession.isLoggedIn(session);
    const postIdObj = new ObjectId(postId);
    return await Comment.getByRoot(postIdObj);
  }

  // Get posts sorted by upvotes in descending order
  @Router.get("/posts/sorted")
  async getSortedPosts() {
    const posts = await Post.getPosts(); // Get all posts
    const postsWithUpvoteCounts = await Promise.all(
      posts.map(async (post) => {
        const count = await Upvote.countUpvotesForItem(post._id);
        return { ...post, upvotes: count };
      }),
    );

    // Sort posts by upvotes in descending order
    postsWithUpvoteCounts.sort((a, b) => b.upvotes - a.upvotes);
    return postsWithUpvoteCounts;
  }

  // Get the last created post
  @Router.get("/posts/last")
  async getLastPost() {
    const posts = await Post.getPosts();
    return posts[posts.length - 1];
  }

  // Favorite a post by its ID
  @Router.post("/posts/:_id/favorite")
  async favoritePost(session: WebSessionDoc, _id: string) {
    const username = WebSession.getUser(session); // Get username from session
    const objectId = new ObjectId(_id); // Convert _id string to ObjectId
    return await Favorite.favorite(objectId, username); // Favorite the post
  }

  // Get all favorites of the logged-in user
  @Router.get("/favorites")
  async getUserFavorites(session: WebSessionDoc) {
    WebSession.isLoggedIn(session);
    const author = WebSession.getUser(session);
    return await Favorite.getFavoritesForAuthor(author);
  }

  // Make a comment on a parent comment or post by the logged in user
  @Router.post("/comments/:parent")
  async createComment(session: WebSessionDoc, parent: string, content: string) {
    WebSession.isLoggedIn(session);
    const author = WebSession.getUser(session);
    return await Comment.create(author, content, new ObjectId(parent));
  }

  // Get flat comments for a given post by its id
  @Router.get("/posts/:_id/comments/flat")
  async getFlatCommentsForPost(session: WebSessionDoc, _id: string) {
    WebSession.isLoggedIn(session);
    const rootId = new ObjectId(_id);
    return await Comment.getByRootFlat(rootId);
  }
}

export default getExpressRouter(new Routes());
