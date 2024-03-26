import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotFoundError, NotAllowedError } from "../framework/errors";

interface CommentDoc extends BaseDoc {
  author: ObjectId;
  content: string;
  parent: ObjectId;
  root: ObjectId;
  depth: number;
}

export default class CommentConcept {
  private readonly comments: DocCollection<CommentDoc>;

  constructor(collectionName: string) {
    this.comments = new DocCollection<CommentDoc>(collectionName);
  }

  async create(author: ObjectId, content: string, parent: ObjectId) {
    const parentComment = await this.comments.readOne({ _id: parent });
    const root = parentComment ? parentComment.root : parent;
    const depth = parentComment ? parentComment.depth + 1 : 0;

    const _id = await this.comments.createOne({ author, content, parent, root, depth });
    return await this.comments.readOne({ _id });
  }

  async update(_id: ObjectId, content: string) {
    const updateResult = await this.comments.updateOne({ _id }, { content });
    if (!updateResult.matchedCount) {
      throw new NotFoundError(`Comment not found with id: ${_id}`);
    }
    return updateResult;
  }

  async delete(_id: ObjectId) {
    // Check if child comments exist
    const childComments = await this.comments.readMany({ parent: _id });
    if (childComments.length) {
      throw new NotAllowedError("Cannot delete comment with child comments");
    }
    await this.comments.deleteOne({ _id });
    return { msg: "Comment deleted!" };
  }

  async getById(_id: ObjectId) {
    const comment = await this.comments.readOne({ _id });
    if (!comment) {
      throw new NotFoundError(`Comment not found with id: ${_id}`);
    }
    return comment;
  }

  async getByAuthor(author: ObjectId) {
    return await this.comments.readMany({ author });
  }

  async getByIds(ids: ObjectId[]) {
    const comments = await this.comments.readMany({ _id: { $in: ids } });
    return comments.reduce(
      (acc, comment) => {
        acc[comment._id.toString()] = comment;
        return acc;
      },
      {} as Record<string, CommentDoc>,
    );
  }

  async getByParent(parent: ObjectId) {
    const buildTree = async (parent: ObjectId) => {
      // Get all comments with parent
      const comments = await this.comments.readMany({ parent });
      const result = [];
      for (const comment of comments) {
        result.push(comment);
        // Get all child comments
        const childComments = await buildTree(comment._id);
        result.push(...childComments);
      }
      return result;
    };
    return buildTree(parent);
  }

  async countByRoots(roots: ObjectId[]) {
    const counts = await Promise.all(
      roots.map(async (root) => {
        const count = await this.comments.readMany({ root }).then((cmnts) => cmnts.length);
        return { root: root.toString(), count };
      }),
    );
    return counts.reduce(
      (acc, curr) => {
        acc[curr.root] = curr.count;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  async isUserAuthor(_id: ObjectId, user: ObjectId) {
    const comment = await this.comments.readOne({ _id });
    return comment && comment.author.equals(user);
  }
}
