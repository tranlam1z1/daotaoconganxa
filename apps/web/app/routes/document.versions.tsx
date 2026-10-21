import { PageStub } from "../components/PageStub";

export default function DocumentVersions() {
  return (
    <PageStub
      title="Phiên bản"
      icon="layers"
      embedded
      features={[
        "Danh sách phiên bản theo ngày hiệu lực và văn bản gây ra thay đổi.",
        "So sánh nhanh hai phiên bản liền kề.",
      ]}
    />
  );
}
