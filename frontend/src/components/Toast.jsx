import { IoBookmark } from "react-icons/io5";
import "./Toast.css";

export default function Toast({ visible, message }) {
  return (
    <div className={`toast ${visible ? "toast--visible" : ""}`}>
      <IoBookmark size={16} color="#E76F51" />
      <span>{message}</span>
    </div>
  );
}