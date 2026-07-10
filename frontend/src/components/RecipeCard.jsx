import { useState } from "react";
import { IoTimeOutline, IoPeopleOutline, IoBookmark, IoBookmarkOutline } from "react-icons/io5";
import AuthorTag from "./AuthorTag";
import { getContrastTextColor } from "../../lib/colorUtils";

export default function RecipeCard({
  item,
  viewMode, // "card" | "list" | "grid"
  categoriesMap,
  getAuthor,
  isSaved,
  onToggleSave,
  onPress,
}) {
  const [imageError, setImageError] = useState(false);
  const totalTime = (Number(item.prep_time) || 0) + (Number(item.cook_time) || 0);

  const handleSaveClick = (e) => {
    e.stopPropagation(); // don't trigger onPress when tapping the bookmark
    onToggleSave();
  };

  const categoryPills = (
    <div className="recipe-card__pills">
      {item.categories?.map((cat, i) => {
        const color = categoriesMap[cat] || "#F4A261";
        return (
          <span
            key={i}
            className="recipe-card__pill"
            style={{ backgroundColor: color, color: getContrastTextColor(color) }}
          >
            {cat}
          </span>
        );
      })}
    </div>
  );

  const image =
    item.image_url && !imageError ? (
      <img
        src={item.image_url}
        alt={item.title}
        loading="lazy"
        onError={() => setImageError(true)}
        className={
          viewMode === "grid"
            ? "recipe-card__image recipe-card__image--grid"
            : viewMode === "list"
            ? "recipe-card__image recipe-card__image--list"
            : "recipe-card__image"
        }
        style={
          viewMode === "grid" && item.image_aspect_ratio
            ? { aspectRatio: item.image_aspect_ratio, height: "auto" }
            : undefined
        }
      />
    ) : (
      <div
        className={
          viewMode === "list" ? "recipe-card__placeholder recipe-card__placeholder--list" : "recipe-card__placeholder"
        }
      >
        <img src="/assets/gray-logo.png" alt="" className="recipe-card__placeholder-logo" />
      </div>
    );

  if (viewMode === "list") {
    return (
      <div className="recipe-list-item" onClick={onPress}>
        <div className="recipe-list-item__image-wrap">{image}</div>
        <div className="recipe-list-item__content">
          <h3 className="recipe-list-item__title">{item.title}</h3>
          {item.servings ? <p className="recipe-list-item__meta">{item.servings} servings</p> : null}
          {item.prep_time ? <p className="recipe-list-item__meta">{totalTime} mins</p> : null}
          <AuthorTag recipe={item} getAuthor={getAuthor} />
        </div>
        <button className="recipe-list-item__bookmark" onClick={handleSaveClick} aria-label="Save recipe">
          {isSaved ? <IoBookmark size={20} color="#E76F51" /> : <IoBookmarkOutline size={20} color="#8C6A4A" />}
        </button>
      </div>
    );
  }

  // "card" and "grid" share the same markup; grid gets extra sizing via CSS
  return (
    <div className={viewMode === "grid" ? "recipe-card recipe-card--grid" : "recipe-card"} onClick={onPress}>
      <div className="recipe-card__image-wrap">
        {image}
        {categoryPills}
      </div>
      <div className="recipe-card__content">
        <h3 className="recipe-card__title">{item.title}</h3>
        {!!item.description && <p className="recipe-card__subtitle">{item.description}</p>}
        {(!!totalTime || !!item.servings) && (
          <div className="recipe-card__meta-row">
            {!!totalTime && (
              <span className="recipe-card__meta">
                <IoTimeOutline size={12} color="#5C3D1E" /> {totalTime} min(s)
              </span>
            )}
            {!!item.servings && (
              <span className="recipe-card__meta">
                <IoPeopleOutline size={12} color="#5C3D1E" /> {item.servings} serving(s)
              </span>
            )}
          </div>
        )}
        <AuthorTag recipe={item} getAuthor={getAuthor} />
        <button className="recipe-card__bookmark" onClick={handleSaveClick} aria-label="Save recipe">
          {isSaved ? <IoBookmark size={15} color="#E76F51" /> : <IoBookmarkOutline size={15} color="#8C6A4A" />}
        </button>
      </div>
    </div>
  );
}