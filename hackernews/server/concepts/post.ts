import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotFoundError, NotAllowedError } from "../framework/errors";

interface PostDoc extends BaseDoc {
  author: ObjectId;
  title: string;
  url?: string;
  text?: string;
}

interface GetPostsOptions {
  dateStart?: Date;
  dateEnd?: Date;
  page?: number;
  count?: number;
  titlePrefix?: string;
}

export default class PostConcept {
  private readonly posts: DocCollection<PostDoc>;

  constructor(collectionName: string) {
    this.posts = new DocCollection<PostDoc>(collectionName);
  }

  async create(author: ObjectId, title: string, url?: string, text?: string) {
    if (!title) {
      throw new NotAllowedError("Title is required.");
    }
    const _id = await this.posts.createOne({ author, title, url, text });
    return await this.posts.readOne({ _id });
  }

  async update(_id: ObjectId, author: ObjectId, title: string, url?: string, text?: string) {
    const post = await this.posts.readOne({ _id });
    if (!post) {
      throw new NotFoundError("Post not found.");
    }
    const twoHours = 2 * 60 * 60 * 1000;
    if (new Date().getTime() - post.dateCreated.getTime() > twoHours) {
      throw new NotAllowedError("Posts can only be updated within 2 hours of creation.");
    }
    if (!post.author.equals(author)) {
      throw new NotAllowedError("Only the author can update the post.");
    }
    await this.posts.replaceOne({ _id }, { author, title, url, text });
  }

  async delete(_id: ObjectId, author: ObjectId) {
    const post = await this.posts.readOne({ _id });
    if (!post) {
      throw new NotFoundError("Post not found.");
    }
    const twoHours = 2 * 60 * 60 * 1000;
    if (new Date().getTime() - post.dateCreated.getTime() > twoHours) {
      throw new NotAllowedError("Posts can only be deleted within 2 hours of creation.");
    }
    if (!post.author.equals(author)) {
      throw new NotAllowedError("Only the author can delete the post.");
    }
    await this.posts.deleteOne({ _id });
  }

  async getByAuthor(author: ObjectId) {
    return await this.posts.readMany({ author }, { sort: { dateCreated: -1 } });
  }

  async get(options?: GetPostsOptions) {
    const { dateStart, dateEnd, page = 1, count = 30, titlePrefix } = options || {};
    const filter: any = {};
    if (dateStart) filter.dateCreated = { $gte: dateStart };
    if (dateEnd) filter.dateCreated = { ...(filter.dateCreated || {}), $lte: dateEnd };
    if (titlePrefix) filter.title = { $regex: `^${titlePrefix}`, $options: "i" };

    return await this.posts.readMany(filter, {
      skip: (page - 1) * count,
      limit: count,
      sort: { dateCreated: -1 },
    });
  }

  async getById(_id: ObjectId) {
    return await this.posts.readOne({ _id });
  }

  async getByIds(ids: ObjectId[]) {
    const posts = await this.posts.readMany({ _id: { $in: ids } }, { sort: { dateCreated: -1 } });
    return posts.reduce(
      (map, post) => {
        map[post._id.toString()] = post;
        return map;
      },
      {} as Record<string, PostDoc>,
    );
  }

  async isUserAuthor(_id: ObjectId, author: ObjectId): Promise<boolean> {
    const post = await this.posts.readOne({ _id });
    return post ? post.author.equals(author) : false;
  }
}
