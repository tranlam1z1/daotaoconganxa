import { PageStub } from "../components/PageStub";

export default function DocumentProperties() {
  return (
    <PageStub
      title="Thuộc tính"
      icon="book"
      embedded
      features={[
        "Thông tin định danh: số ký hiệu, cơ quan ban hành, người ký, ngày ban hành.",
        "Lịch sử hiệu lực theo mốc thời gian.",
      ]}
    />
  );
}
