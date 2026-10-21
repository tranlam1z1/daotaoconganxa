import { PageStub } from "../components/PageStub";

export default function DocumentDiagram() {
  return (
    <PageStub
      title="Lược đồ"
      icon="layers"
      embedded
      features={[
        "Văn bản căn cứ, văn bản hướng dẫn và văn bản sửa đổi.",
        "Nhóm quan hệ theo loại tác động và điều khoản bị tác động.",
      ]}
    />
  );
}
