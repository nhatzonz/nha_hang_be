import numpy as np


def to_matrix(embeddings: list[list[float]]) -> np.ndarray:
    return np.asarray(embeddings, dtype=np.float32)


def cosine_scores(query: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """Cosine similarity giữa 1 vector query và từng dòng của matrix."""
    if matrix.size == 0:
        return np.array([], dtype=np.float32)
    q_norm = np.linalg.norm(query) or 1.0
    m_norm = np.linalg.norm(matrix, axis=1)
    m_norm[m_norm == 0] = 1.0
    return (matrix @ query) / (m_norm * q_norm)


def top_k(
    query: list[float],
    rows: list[dict],
    k: int,
    exclude_ids: set[int] | None = None,
) -> list[dict]:
    """Xếp hạng rows theo cosine với query, trả top-k (kèm trường `score`).

    Mỗi row cần có 'embedding' (list float) và 'menu_item_id'.
    """
    exclude_ids = exclude_ids or set()
    candidates = [r for r in rows if r["menu_item_id"] not in exclude_ids]
    if not candidates:
        return []

    matrix = to_matrix([r["embedding"] for r in candidates])
    scores = cosine_scores(np.asarray(query, dtype=np.float32), matrix)

    order = np.argsort(-scores)[:k]
    result = []
    for idx in order:
        row = dict(candidates[idx])
        row.pop("embedding", None)  # không trả vector thô về client
        row["score"] = round(float(scores[idx]), 4)
        result.append(row)
    return result


def average_vector(embeddings: list[list[float]]) -> list[float] | None:
    if not embeddings:
        return None
    return np.mean(to_matrix(embeddings), axis=0).tolist()
