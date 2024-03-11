import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotFoundError } from "../framework/errors";

interface PostDoc extends BaseDoc {
  author: string;
  content: string;
}

export default class PostConcept {
  public readonly posts: DocCollection<PostDoc>;

  constructor(collectionName: string) {
    this.posts = new DocCollection<PostDoc>(collectionName);
  }

  async createPost(author: string, content: string) {
    const _id = await this.posts.createOne({ author, content });
    return { msg: "Post created successfully!", post: await this.posts.readOne({ _id }) };
  }

  async getPosts() {
    return await this.posts.readMany({});
  }

  async getPostsByAuthor(author: string) {
    return await this.posts.readMany({ author });
  }
}
