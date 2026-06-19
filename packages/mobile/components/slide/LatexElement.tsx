import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { PPTLatexElement, SlideTheme } from './types';
import { sFont, isSmallScreen } from '@/lib/utils/scaling';

interface LatexElementProps {
  element: PPTLatexElement;
  theme: SlideTheme;
  scaleX: number;
  scaleY: number;
  isWhiteboard?: boolean;
}

/**
 * Basic LaTeX → Unicode conversion for common patterns
 * Falls back to raw LaTeX for unrecognized commands
 */
function simplifyLatex(latex: string): string {
  let result = latex;

  // Superscripts: x^{2} → x², x^{3} → x³, x^{n} → xⁿ
  result = result.replace(/\^{(\d+)}/g, (_, d) => {
    const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    return String(d).split('').map((c: string) => superscripts[parseInt(c)] ?? c).join('');
  });
  result = result.replace(/\^{([a-z])}/gi, (_, c) => {
    const map: Record<string, string> = { n: 'ⁿ', i: 'ⁱ' };
    return map[c] ?? `^${c}`;
  });

  // Subscripts: x_{0} → x₀, x_{i} → xᵢ
  result = result.replace(/_{(\d+)}/g, (_, d) => {
    const subs = '₀₁₂₃₄₅₆₇₈₉';
    return String(d).split('').map((c: string) => subs[parseInt(c)] ?? c).join('');
  });

  // Fractions: \frac{a}{b} → a/b
  result = result.replace(/\\frac\{([^}]*)}\{([^}]*)}/g, '$1/$2');

  // Square root: \sqrt{x} → √x
  result = result.replace(/\\sqrt\{([^}]*)}/g, '√($1)');

  // Common commands — longest first to avoid partial matches
  const COMMANDS: Array<[string, string]> = [
    ['\\Leftrightarrow', '⇔'],
    ['\\Rightarrow', '⇒'],
    ['\\Leftarrow', '⇐'],
    ['\\rightarrow', '→'],
    ['\\leftarrow', '←'],
    ['\\partial', '∂'],
    ['\\epsilon', 'ε'],
    ['\\nabla', '∇'],
    ['\\approx', '≈'],
    ['\\equiv', '≡'],
    ['\\times', '×'],
    ['\\infty', '∞'],
    ['\\prod', '∏'],
    ['\\leq', '≤'],
    ['\\geq', '≥'],
    ['\\neq', '≠'],
    ['\\sum', '∑'],
    ['\\int', '∫'],
    ['\\div', '÷'],
    ['\\pm', '±'],
    ['\\cdot', '·'],
    ['\\alpha', 'α'],
    ['\\beta', 'β'],
    ['\\gamma', 'γ'],
    ['\\delta', 'δ'],
    ['\\theta', 'θ'],
    ['\\lambda', 'λ'],
    ['\\mu', 'μ'],
    ['\\sigma', 'σ'],
    ['\\omega', 'ω'],
    ['\\phi', 'φ'],
    ['\\pi', 'π'],
  ];
  for (const [cmd, sym] of COMMANDS) {
    result = result.replace(new RegExp(cmd.replace(/\\/g, '\\\\'), 'g'), sym);
  }

  // Remove remaining \command patterns
  result = result.replace(/\\[a-zA-Z]+/g, '');

  // Clean up braces
  result = result.replace(/[{}]/g, '');

  return result.trim() || latex;
}

export function LatexElement({ element, theme, scaleX, scaleY, isWhiteboard = false }: LatexElementProps) {
  const containerStyle = useMemo(() => {
    return {
      position: 'absolute' as const,
      left: element.left * scaleX,
      top: element.top * scaleY,
      width: Math.max(element.width * scaleX, 60),
      minHeight: element.height > 0 ? element.height * scaleY : 40,
      zIndex: 1,
    };
  }, [element, scaleX, scaleY]);

  const fontSize = sFont(16, isSmallScreen ? 10 : 12);
  const displayText = useMemo(() => simplifyLatex(element.latex), [element.latex]);

  return (
    <View style={containerStyle}>
      <View style={styles.formulaBox}>
        <Text style={[styles.formulaText, { fontSize, color: element.color ?? '#333' }]} selectable>
          {displayText}
        </Text>
      </View>
    </View>
  );
}

const styles = {
  formulaBox: {
    flex: 1,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    padding: 8,
    justifyContent: 'center' as const,
  },
  formulaText: {
    fontFamily: 'Menlo' as const,
    letterSpacing: 0.5,
    textAlign: 'center' as const,
  },
};
