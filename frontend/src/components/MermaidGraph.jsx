import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

export default function MermaidGraph({ chart }) {
  const containerRef = useRef(null);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: 'rgba(31,45,69,0.8)',
        primaryTextColor: '#e2e8f0',
        primaryBorderColor: '#7c3aed',
        lineColor: '#a78bfa',
        secondaryColor: 'rgba(124,58,237,0.2)',
        tertiaryColor: 'rgba(16,185,129,0.2)',
        fontFamily: 'var(--font-sans)',
        edgeLabelBackground: '#0f172a',
      },
      securityLevel: 'loose',
    });
  }, []);

  useEffect(() => {
    if (!chart) return;
    
    let isMounted = true;
    const renderChart = async () => {
      try {
        setError(false);
        let cleanChart = chart
          .replace(/```mermaid\n?/gi, '')
          .replace(/```\n?/g, '')
          .replace(/[—–]/g, '-')
          .replace(/->/g, '-->')
          .replace(/--->/g, '-->')
          .trim();
        
        // Generate a unique ID for the mermaid diagram to prevent collisions
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: svgCode } = await mermaid.render(id, cleanChart);
        if (isMounted) setSvg(svgCode);
      } catch (e) {
        console.error('Mermaid rendering error:', e);
        if (isMounted) {
          setSvg('');
          setError(true);
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart]);

  if (!chart) return null;

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        overflowX: 'auto',
        display: 'flex',
        justifyContent: 'center',
        padding: '10px 0',
        minHeight: '150px',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '8px',
        border: '1px solid var(--border)'
      }}
    >
      {error ? (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '0 16px' }}>
          <div style={{ color: '#fca5a5', fontSize: 11, marginBottom: 8, fontWeight: 600 }}>
            ⚠️ Diagram generation failed. Showing raw logic format:
          </div>
          <pre style={{ 
            fontSize: 11, color: '#93c5fd', fontFamily: 'var(--font-mono)', 
            background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 6, margin: 0,
            whiteSpace: 'pre-wrap', wordBreak: 'break-all'
          }}>
            {chart.replace(/```mermaid\n?/gi, '').replace(/```\n?/g, '').trim()}
          </pre>
        </div>
      ) : svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Rendering diagram...</div>
      )}
    </div>
  );
}
