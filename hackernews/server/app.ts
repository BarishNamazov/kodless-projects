import WebSessionConcept from "./concepts/websession";
import UserConcept from "./concepts/user";
import PostConcept from "./concepts/post";
import CommentConcept from "./concepts/comment";
import KarmaConcept from "./concepts/karma";
import VoteConcept from "./concepts/vote";
import MarkConcept from "./concepts/mark";

// App Definition using concepts
export const WebSession = new WebSessionConcept();
export const User = new UserConcept("users");
export const Post = new PostConcept("posts");
export const Comment = new CommentConcept("comments");
export const Karma = new KarmaConcept("karma");
export const PostVotes = new VoteConcept("postVotes");
export const CommentVotes = new VoteConcept("commentVotes");
export const Favorite = new MarkConcept("favorites");
export const Hide = new MarkConcept("hides");
export const Flag = new MarkConcept("flags");
