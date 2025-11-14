import type { NewsQuestion, NewsRecord } from '../../services/data/newsService';

export type GraphNode = {
  id: string;
  label: string;
  value: number;
  title?: string;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  value: number;
  label?: string;
};

export type NodeQuestion = {
  questionId: string;
  record: NewsRecord;
  question: NewsQuestion;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  questionIndex: Record<string, NodeQuestion[]>;
};

function buildQuestionId(dateId: string, index: number) {
  return `current-affairs-${dateId}-${String(index + 1).padStart(3, '0')}`;
}

export function buildGraphFromRecords(records: NewsRecord[]): GraphData {
  const nodeMap = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphEdge>();
  const questionIndexMap = new Map<string, NodeQuestion[]>();

  records.forEach((record) => {
    const uniqueEntities = Array.from(new Set(record.named_entities));

    uniqueEntities.forEach((entity) => {
      const nodeId = entity;
      const nextValue = (nodeMap.get(nodeId)?.value ?? 0) + 1;
      nodeMap.set(nodeId, {
        id: nodeId,
        label: entity,
        value: nextValue,
        title: `${entity}\n登場回数: ${nextValue}`
      });
    });

    for (let i = 0; i < uniqueEntities.length; i += 1) {
      for (let j = i + 1; j < uniqueEntities.length; j += 1) {
        const from = uniqueEntities[i];
        const to = uniqueEntities[j];
        const edgeKey = [from, to].sort().join('::');
        const prevValue = edgeMap.get(edgeKey)?.value ?? 0;
        edgeMap.set(edgeKey, {
          id: edgeKey,
          from,
          to,
          value: prevValue + 1,
          label: String(prevValue + 1)
        });
      }
    }

    record.questions.forEach((question, qIndex) => {
      const questionId = buildQuestionId(record.date_id, qIndex);
      uniqueEntities.forEach((entity) => {
        const list = questionIndexMap.get(entity) ?? [];
        list.push({
          questionId,
          record,
          question
        });
        questionIndexMap.set(entity, list);
      });
    });
  });

  const nodes = Array.from(nodeMap.values());
  const edges = Array.from(edgeMap.values());
  const questionIndex: Record<string, NodeQuestion[]> = {};
  questionIndexMap.forEach((value, key) => {
    questionIndex[key] = value;
  });

  return { nodes, edges, questionIndex };
}
