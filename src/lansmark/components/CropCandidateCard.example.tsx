import type { CropCandidateResult } from "../types";

export function CropCandidateCard({
  candidate,
  onSelect,
}: {
  candidate: CropCandidateResult;
  onSelect?: (cropId: string) => void;
}) {
  return (
    <article className="rounded-xl border p-4">
      <h3 className="text-lg font-semibold">{candidate.cropNameKo}</h3>
      <p className="text-sm text-gray-600">
        적합 방향: {candidate.suitability} · 신뢰도 {candidate.confidence} · 점수 {candidate.score}
      </p>

      <div className="mt-3">
        <h4 className="font-medium">가능성이 있는 이유</h4>
        <ul className="list-disc pl-5 text-sm">
          {candidate.reasons.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-3">
        <h4 className="font-medium">주요 리스크</h4>
        <ul className="list-disc pl-5 text-sm">
          {candidate.risks.slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <button className="mt-4 rounded-lg border px-3 py-2 text-sm" onClick={() => onSelect?.(candidate.cropId)}>
        수확·소득 시뮬레이션
      </button>
    </article>
  );
}
