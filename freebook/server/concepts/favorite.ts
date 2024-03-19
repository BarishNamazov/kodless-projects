import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotFoundError } from "../framework/errors";

export interface FavoriteDoc extends BaseDoc {
  item: ObjectId;
  author: string;
}

export default class FavoriteConcept {
  public readonly favorites: DocCollection<FavoriteDoc>;

  constructor(collectionName: string) {
    this.favorites = new DocCollection<FavoriteDoc>(collectionName);
  }

  async favorite(item: ObjectId, author: string) {
    const existingFavorite = await this.favorites.readOne({ item, author });
    if (!existingFavorite) {
      await this.favorites.createOne({ item, author });
      return { msg: "Item favorited successfully!" };
    }
    return { msg: "Item already favorited by the author." };
  }

  async unfavorite(item: ObjectId, author: string) {
    const deleteResult = await this.favorites.deleteOne({ item, author });
    if (deleteResult.deletedCount === 0) {
      throw new NotFoundError("Favorite not found.");
    }
    return { msg: "Item unfavorited successfully!" };
  }

  async getFavoritesForAuthor(author: string) {
    const favorites = await this.favorites.readMany({ author });
    return favorites.map((favorite) => ({ item: favorite.item, _id: favorite._id }));
  }
}
