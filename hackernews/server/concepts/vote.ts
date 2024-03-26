import { ObjectId, Filter } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotFoundError, NotAllowedError } from "../framework/errors";

export interface VoteDoc extends BaseDoc {
  author: ObjectId;
  item: ObjectId;
  type: "up" | "down";
}

export default class VoteConcept {
  public readonly votes: DocCollection<VoteDoc>;

  constructor(collectionName: string) {
    this.votes = new DocCollection<VoteDoc>(collectionName);
  }

  private async isVoteExisting(author: ObjectId, item: ObjectId): Promise<boolean> {
    const vote = await this.votes.readOne({ author, item });
    return !!vote;
  }

  async upvote(author: ObjectId, item: ObjectId) {
    if (await this.isVoteExisting(author, item)) {
      throw new NotAllowedError("User already voted on this item. Unvote to change the vote.");
    }
    await this.votes.createOne({ author, item, type: "up" });
  }

  async downvote(author: ObjectId, item: ObjectId) {
    if (await this.isVoteExisting(author, item)) {
      throw new NotAllowedError("User already voted on this item. Unvote to change the vote.");
    }
    await this.votes.createOne({ author, item, type: "down" });
  }

  async unvote(author: ObjectId, item: ObjectId) {
    await this.votes.deleteOne({ author, item });
  }

  async getUpvoted(author: ObjectId): Promise<VoteDoc[]> {
    return this.votes.readMany({ author, type: "up" });
  }

  async getVote(author: ObjectId, item: ObjectId): Promise<VoteDoc | null> {
    return this.votes.readOne({ author, item });
  }

  async getVotes(author: ObjectId, items?: ObjectId[]): Promise<Record<string, VoteDoc>> {
    let filter: Filter<VoteDoc> = { author };
    if (items && items.length) {
      filter = { ...filter, item: { $in: items } };
    }
    const votes = await this.votes.readMany(filter);
    const votesMap: Record<string, VoteDoc> = {};
    votes.forEach((vote) => {
      votesMap[vote.item.toString()] = vote;
    });
    return votesMap;
  }

  async getItemPts(item: ObjectId): Promise<number> {
    const upvotes = await this.votes.readMany({ item, type: "up" });
    const downvotes = await this.votes.readMany({ item, type: "down" });
    return upvotes.length - downvotes.length;
  }

  async getItemsPts(ids: ObjectId[]): Promise<Record<string, number>> {
    const ptsMap: Record<string, number> = {};
    for (const id of ids) {
      ptsMap[id.toString()] = await this.getItemPts(id);
    }
    return ptsMap;
  }
}
