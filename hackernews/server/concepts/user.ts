import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { BadValuesError, NotAllowedError, NotFoundError } from "../framework/errors";

export interface UserDoc extends BaseDoc {
  username: string;
  password: string;
  email?: string;
  bio?: string;
  topBarColor: string;
}

export default class UserConcept {
  public readonly users: DocCollection<UserDoc>;

  constructor(collectionName: string) {
    this.users = new DocCollection<UserDoc>(collectionName);

    void this.users.collection.createIndex({ username: 1 }, { unique: true });
  }

  async create(username: string, password: string) {
    await this.canCreate(username, password);
    const defaultTopBarColor = "#ff6600";
    const _id = await this.users.createOne({ username, password, topBarColor: defaultTopBarColor });
    return { msg: "User created successfully!", user: await this.users.readOne({ _id }) };
  }

  async getById(_id: ObjectId) {
    const user = await this.users.readOne({ _id });
    if (!user) {
      throw new NotFoundError("User not found!");
    }
    return this.sanitizeUser(user);
  }

  async getByIds(ids: ObjectId[]) {
    const usersMapping: Record<string, Partial<UserDoc>> = {};
    for (const id of ids) {
      const user = await this.users.readOne({ _id: id });
      if (user) {
        usersMapping[id.toString()] = this.sanitizeUser(user);
      }
    }
    return usersMapping;
  }

  async getByUsername(username: string) {
    const user = await this.users.readOne({ username });
    if (!user) {
      throw new NotFoundError("User not found!");
    }
    return this.sanitizeUser(user);
  }

  async update(_id: ObjectId, email?: string, bio?: string) {
    await this.users.updateOne({ _id }, { email, bio });
    return { msg: "User updated!" };
  }

  async authenticate(username: string, password: string) {
    const user = await this.users.readOne({ username, password });
    if (!user) {
      throw new NotAllowedError("Username or password is incorrect.");
    }
    return { msg: "Successfully authenticated.", _id: user._id };
  }

  async changePassword(_id: ObjectId, oldPassword: string, newPassword: string) {
    const user = await this.users.readOne({ _id });
    if (!user) {
      throw new NotFoundError("User not found!");
    }
    if (user.password !== oldPassword) {
      throw new NotAllowedError("Old password is incorrect!");
    }

    await this.users.updateOne({ _id }, { password: newPassword });
    return { msg: "Password updated successfully!" };
  }

  async changeTopBar(_id: ObjectId, topBarColor: string) {
    await this.users.updateOne({ _id }, { topBarColor });
    return { msg: "Top bar color changed successfully!" };
  }

  private async canCreate(username: string, password: string) {
    if (!username || !password) {
      throw new BadValuesError("Username and password must be non-empty!");
    }
    await this.isUsernameUnique(username);
  }

  private async isUsernameUnique(username: string) {
    if (await this.users.readOne({ username })) {
      throw new NotAllowedError(`User with username "${username}" already exists!`);
    }
  }

  private sanitizeUser(user: UserDoc) {
    const { password, ...rest } = user;
    return rest;
  }
}
