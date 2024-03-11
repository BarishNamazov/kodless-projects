import WebSessionConcept from "./concepts/websession";
import PostConcept from "./concepts/post";
import UpvoteConcept from "./concepts/upvote";
import CommentConcept from "./concepts/comment";

// App Definition using concepts
export const WebSession = new WebSessionConcept();
export const Post = new PostConcept("posts");
export const Upvote = new UpvoteConcept("upvotes_on_posts");
export const Comment = new CommentConcept("comments_on_posts");
