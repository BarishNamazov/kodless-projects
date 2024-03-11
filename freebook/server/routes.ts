import { Router, getExpressRouter } from "./framework/router";

import { WebSession, Post, Upvote, Comment } from "./app";
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

  // Make a comment on a parent comment or post
  @Router.post("/comments/:parent")
  async createComment(session: WebSessionDoc, author: string, content: string, parent: string) {
    WebSession.isLoggedIn(session); // Ensure the user is logged in
    // Convert parent ID from string to ObjectId for database operation
    const parentId = new ObjectId(parent);
    return await Comment.create(author, content, parentId);
  }

  // Get comments for a specific post by postId
  @Router.get("/comments/:postId")
  async getCommentsForPost(session: WebSessionDoc, postId: string) {
    WebSession.isLoggedIn(session);
    const postIdObj = new ObjectId(postId);
    return await Comment.getByRoot(postIdObj);
  }
}

export default getExpressRouter(new Routes());
