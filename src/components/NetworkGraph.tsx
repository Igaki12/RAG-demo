import { useEffect, useRef } from 'react';
import { Box, useColorModeValue } from '@chakra-ui/react';
import { DataSet, Network, Options } from 'vis-network/standalone';
import type { GraphEdge, GraphNode } from '../lib/vis/transformers';

export type NetworkGraphProps = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
};

function NetworkGraph({ nodes, edges, selectedNodeId, onNodeSelect }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  const background = useColorModeValue('white', 'gray.800');

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const data = {
      nodes: new DataSet(nodes),
      edges: new DataSet(edges)
    };

    const options: Options = {
      autoResize: true,
      nodes: {
        shape: 'dot',
        scaling: {
          min: 5,
          max: 40
        },
        font: {
          size: 16
        }
      },
      edges: {
        smooth: true,
        arrows: {
          to: false
        }
      },
      physics: {
        stabilization: true,
        barnesHut: {
          springConstant: 0.01,
          avoidOverlap: 0.1
        }
      }
    };

    const network = new Network(containerRef.current, data, options);
    networkRef.current = network;

    const handleSelectNode = (params: { nodes: Array<string | number> }) => {
      const nodeId = params.nodes[0];
      onNodeSelect?.(typeof nodeId === 'string' ? nodeId : String(nodeId));
    };

    const handleDeselectNode = () => {
      onNodeSelect?.(null);
    };

    network.on('selectNode', handleSelectNode);
    network.on('deselectNode', handleDeselectNode);

    return () => {
      network.off('selectNode', handleSelectNode);
      network.off('deselectNode', handleDeselectNode);
      network.destroy();
      networkRef.current = null;
    };
  }, [edges, nodes, onNodeSelect]);

  useEffect(() => {
    if (!networkRef.current || !selectedNodeId) {
      return;
    }
    networkRef.current.selectNodes([selectedNodeId]);
    networkRef.current.focus(selectedNodeId, { animation: { duration: 500 } });
  }, [selectedNodeId]);

  return <Box ref={containerRef} w="100%" h={{ base: '480px', md: '700px' }} borderRadius="lg" boxShadow="lg" bg={background} />;
}

export default NetworkGraph;
