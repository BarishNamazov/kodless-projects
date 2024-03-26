import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotFoundError } from "../framework/errors";

interface MarkDoc extends BaseDoc {
  user: ObjectId;
  item: ObjectId;
}

export default class MarkConcept {
  public readonly marks: DocCollection<MarkDoc>;

  constructor(collectionName: string) {
    this.marks = new DocCollection<MarkDoc>(collectionName);
  }

  async mark(user: ObjectId, item: ObjectId) {
    const existingMark = await this.isMarked(user, item);
    if (!existingMark) {
      await this.marks.createOne({ user, item });
      return { msg: "Item marked successfully!" };
    }
    return { msg: "Item is already marked." };
  }

  async unmark(user: ObjectId, item: ObjectId) {
    const result = await this.marks.deleteOne({ user, item });
    if (result.deletedCount === 0) {
      throw new NotFoundError("Mark not found!");
    }
    return { msg: "Item unmarked successfully!" };
  }

  async getByUser(user: ObjectId) {
    return this.marks.readMany({ user });
  }

  async getByItem(item: ObjectId) {
    return this.marks.readMany({ item });
  }

  async getByItems(items: ObjectId[]) {
    return this.marks.readMany({ item: { $in: items } });
  }

  async isMarked(user: ObjectId, item: ObjectId): Promise<boolean> {
    const mark = await this.marks.readOne({ user, item });
    return mark !== null;
  }
}
