import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotFoundError } from "../framework/errors";

export interface UpvoteDoc extends BaseDoc {
  author: string; // Assuming author stores usernames
  item: ObjectId;
}

export default class UpvoteConcept {
  public readonly upvotes: DocCollection<UpvoteDoc>;

  constructor(collectionName: string) {
    this.upvotes = new DocCollection<UpvoteDoc>(collectionName);
  }

  async upvote(author: string, itemId: ObjectId) {
    const existingUpvote = await this.upvotes.readOne({ author, item: itemId });
    if (!existingUpvote) {
      await this.upvotes.createOne({ author, item: itemId });
      return { msg: "Upvote added successfully!" };
    }
    return { msg: "Upvote already exists." };
  }

  async removeUpvote(author: string, itemId: ObjectId) {
    const upvote = await this.upvotes.readOne({ author, item: itemId });
    if (!upvote) {
      throw new NotFoundError("Upvote not found.");
    }
    await this.upvotes.deleteOne({ _id: upvote._id });
    return { msg: "Upvote removed successfully!" };
  }

  async countUpvotesForItem(itemId: ObjectId): Promise<number> {
    const upvotesCount = await this.upvotes.collection.countDocuments({ item: itemId });
    return upvotesCount;
  }

  // New action to return array of usernames of people who upvoted an item
  async getUsersWhoUpvoted(itemId: ObjectId): Promise<string[]> {
    const upvotes = await this.upvotes.readMany({ item: itemId }, { projection: { author: 1 } });
    return upvotes.map((upvote) => upvote.author);
  }
}
