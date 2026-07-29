import AdminHeader from "../../../components/admin/AdminHeader";

export default function Page() {
  return (
    <div>
      <AdminHeader
        title="리뷰관리"
        description="리뷰 신고, 숨김, 삭제 기능은 다음 단계에서 연결합니다."
      />

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
        준비 중인 관리자 기능입니다.
      </div>
    </div>
  );
}
