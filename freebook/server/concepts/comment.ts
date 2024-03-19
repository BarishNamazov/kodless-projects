import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotFoundError } from "../framework/errors";

interface CommentDoc extends BaseDoc {
  root: ObjectId;
  parent: ObjectId;
  author: string;
  content: string;
}

interface CommentWithDepth {
  comment: CommentDoc;
  depth: number;
}

export default class CommentConcept {
  public readonly comments: DocCollection<CommentDoc>;

  constructor(collectionName: string) {
    this.comments = new DocCollection<CommentDoc>(collectionName);
  }

  async create(author: string, content: string, parent: ObjectId) {
    // check if parent is a comment
    const parentComment = await this.comments.readOne({ _id: parent });
    let root;
    if (parentComment) {
      // if parent is a comment, share the root
      root = parentComment.root;
    } else {
      // otherwise, set root to parent (assuming parent is the root if no parent comment is found)
      root = parent;
    }

    const _id = await this.comments.createOne({ root, parent, author, content });
    return { msg: "Comment created successfully!", comment: await this.comments.readOne({ _id }) };
  }

  async getByRoot(root: ObjectId) {
    const comments = await this.comments.readMany({ root });

    const buildTree = (parentId: ObjectId | null) => {
      return comments
        .filter((c) => (parentId ? c.parent.equals(parentId) : c.parent.equals(root)))
        .map((c) => ({
          comment: c,
          children: buildTree(c._id),
        }));
    };

    return buildTree(null);
  }

  async getByRootFlat(root: ObjectId): Promise<CommentWithDepth[]> {
    const comments = await this.comments.readMany({ root });

    // Helper function to recursively flatten the hierarchy
    const flatten = (parentId: ObjectId | null, depth: number = 0): CommentWithDepth[] => {
      return comments
        .filter((c) => (parentId ? c.parent.equals(parentId) : c.parent.equals(root)))
        // Use the binary representation of the ObjectId for sorting instead of compareTo
        .sort((a, b) => a._id.toString().localeCompare(b._id.toString())) // Sorting by _id to maintain a consistent order
        .reduce<CommentWithDepth[]>((acc, current) => {
          // Adding the current comment with its depth
          acc.push({ comment: current, depth });
          // Recursively adding children comments
          acc.push(...flatten(current._id, depth + 1));
          return acc;
        }, []);
    };

    return flatten(null);
  }
}