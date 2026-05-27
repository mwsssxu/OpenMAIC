import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { PPTLatexElement, SlideTheme } from './types';
import { sFont, isSmallScreen } from '@/lib/utils/scaling';

interface LatexElementProps {
  element: PPTLatexElement;
  theme: SlideTheme;
  scaleX: number;
  scaleY: number;
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

  // Common commands
  result = result.replace(/\\times/g, '×');
  result = result.replace(/\\div/g, '÷');
  result = result.replace(/\\pm/g, '±');
  result = result.replace(/\\infty/g, '∞');
  result = result.replace(/\\partial/g, '∂');
  result = result.replace(/\\nabla/g, '∇');
  result = result.replace(/\\sum/g, '∑');
  result = result.replace(/\\int/g, '∫');
  result = result.replace(/\\prod/g, '∏');
  result = result.replace(/\\cdot/g, '·');
  result = result.replace(/\\leq/g, '≤');
  result = result.replace(/\\geq/g, '≥');
  result = result.replace(/\\neq/g, '≠');
  result = result.replace(/\\approx/g, '≈');
  result = result.replace(/\\equiv/g, '≡');
  result = result.replace(/\\rightarrow/g, '→');
  result = result.replace(/\\leftarrow/g, '←');
  result = result.replace(/\\Rightarrow/g, '⇒');
  result = result.replace(/\\Leftrightarrow/g, '⇔');

  // Greek letters
  result = result.replace(/\\alpha/g, 'α');
  result = result.replace(/\\beta/g, 'β');
  result = result.replace(/\\gamma/g, 'γ');
  result = result.replace(/\\delta/g, 'δ');
  result = result.replace(/\\theta/g, 'θ');
  result = result.replace(/\\lambda/g, 'λ');
  result = result.replace(/\\mu/g, 'μ');
  result = result.replace(/\\sigma/g, 'σ');
  result = result.replace(/\\omega/g, 'ω');
  result = result.replace(/\\phi/g, 'φ');
  result = result.replace(/\\pi/g, 'π');
  result = result.replace(/\\epsilon/g, 'ε');

  // Remove remaining \command patterns
  result = result.replace(/\\[a-zA-Z]+/g, '');

  // Clean up braces
  result = result.replace(/[{}]/g, '');

  return result.trim() || latex;
}

export function LatexElement({ element, theme, scaleX, scaleY }: LatexElementProps) {
  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: element.left * scaleX,
    top: element.top * scaleY,
    width: Math.max(element.width * scaleX, 60),
    height: element.height > 0 ? element.height * scaleY : undefined,
    zIndex: 1,
  }), [element, scaleX, scaleY]);

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
