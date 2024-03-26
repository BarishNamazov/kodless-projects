import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError } from "../framework/errors";

interface KarmaDoc extends BaseDoc {
  user: ObjectId;
  points: number;
}

export default class KarmaConcept {
  public readonly karmas: DocCollection<KarmaDoc>;

  constructor(collectionName: string) {
    this.karmas = new DocCollection<KarmaDoc>(collectionName);
  }

  async increase(user: ObjectId, x: number) {
    const karma = await this.karmas.readOne({ user });
    if (karma) {
      await this.karmas.collection.updateOne({ user }, { $inc: { points: x } });
    } else {
      await this.karmas.createOne({ user, points: x });
    }
  }

  async decrease(user: ObjectId, x: number) {
    const karma = await this.karmas.readOne({ user });
    if (karma) {
      await this.karmas.collection.updateOne({ user }, { $inc: { points: -x } });
    } else {
      throw new NotAllowedError("User cannot have negative karma.");
    }
  }

  async get(user: ObjectId) {
    const karma = await this.karmas.readOne({ user });
    if (karma) {
      return karma.points;
    } else {
      return 0; // Assume user starts with 0 karma if not found
    }
  }

  async isAllowed(user: ObjectId, threshold: number) {
    const karma = await this.karmas.readOne({ user });
    if (!karma || karma.points < threshold) {
      throw new NotAllowedError("User does not meet the required karma threshold.");
    }
  }
}
