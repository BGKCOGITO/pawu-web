import AdminHeader from "../../../components/admin/AdminHeader";

export default function Page() {
  return (
    <div>
      <AdminHeader
        title="설정"
        description="관리자 설정과 공공데이터 동기화 설정은 다음 단계에서 연결합니다."
      />

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
        준비 중인 관리자 기능입니다.
      </div>
    </div>
  );
}
