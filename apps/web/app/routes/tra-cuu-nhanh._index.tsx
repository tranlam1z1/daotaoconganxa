import { redirect } from "react-router";
/** Cửa vào cũ của danh mục tra cứu, có nội dung tương đương ở /tra-cuu. */
export function loader() { return redirect("/tra-cuu"); }
