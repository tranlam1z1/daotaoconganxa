/**
 * Bộ mô phỏng giao thông dùng chung (mô-đun M5, docs/GAME_DESIGN.md §4). Tạo ở GĐ-T3 với phần
 * đoạn đường, biển, xe tự chạy; mở rộng ở T5 (nhiều xe, đèn tín hiệu, sự kiện vi phạm, camera),
 * T8 (giao lộ, ưu tiên), T9 (xe người lái), T10 (va chạm, vết), T15 (vật cản tạm, tầm nhìn đêm, vùng
 * nguy hiểm quanh người, hàng chờ). Sửa ngoài các phần mở rộng đã ghi trong kế hoạch thì hỏi trước
 * (GAME_DESIGN §1.7).
 */
export * from "./bien.ts";
export * from "./camera.ts";
export * from "./den.ts";
export * from "./duong.ts";
export * from "./mo-phong.ts";
export * from "./tam-nhin.ts";
export * from "./va-cham.ts";
export * from "./vat-can.ts";
export * from "./xe.ts";
