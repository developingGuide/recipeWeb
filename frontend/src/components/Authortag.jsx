import { IoPersonOutline } from "react-icons/io5";

export default function AuthorTag({ recipe, getAuthor }) {
  const { name, avatar } = getAuthor(recipe);

  return (
    <div className="author-tag">
      {avatar ? (
        <img src={avatar} alt={name} className="author-tag__avatar" loading="lazy" />
      ) : (
        <div className="author-tag__avatar author-tag__avatar--placeholder">
          <IoPersonOutline size={9} color="#8C6A4A" />
        </div>
      )}
      <span className="author-tag__name">{name}</span>
    </div>
  );
}