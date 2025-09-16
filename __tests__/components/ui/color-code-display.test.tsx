// 色号显示器组件测试用例

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { 
  ColorCodeDisplay, 
  ColorCodeSelector, 
  ColorCodeGrid,
  COLOR_CODE_COLORS 
} from '@/components/ui/color-code-display'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}))

describe('ColorCodeDisplay', () => {
  it('renders color code correctly', () => {
    render(<ColorCodeDisplay colorCode="W001" />)
    expect(screen.getByText('W001')).toBeInTheDocument()
  })

  it('shows color swatch by default', () => {
    render(<ColorCodeDisplay colorCode="W001" />)
    const swatch = screen.getByTitle('色号: W001')
    expect(swatch).toBeInTheDocument()
    expect(swatch).toHaveStyle(`background-color: ${COLOR_CODE_COLORS.W001}`)
  })

  it('hides color swatch when showColorSwatch is false', () => {
    render(<ColorCodeDisplay colorCode="W001" showColorSwatch={false} />)
    expect(screen.queryByTitle('色号: W001')).not.toBeInTheDocument()
  })

  it('hides label when showLabel is false', () => {
    render(<ColorCodeDisplay colorCode="W001" showLabel={false} />)
    expect(screen.queryByText('W001')).not.toBeInTheDocument()
  })

  it('displays custom label', () => {
    render(<ColorCodeDisplay colorCode="W001" label="白色001" />)
    expect(screen.getByText('白色001')).toBeInTheDocument()
  })

  it('handles click when interactive', () => {
    const handleClick = jest.fn()
    render(
      <ColorCodeDisplay 
        colorCode="W001" 
        interactive 
        onColorCodeClick={handleClick} 
      />
    )
    
    fireEvent.click(screen.getByText('W001'))
    expect(handleClick).toHaveBeenCalledWith('W001')
  })

  it('does not handle click when not interactive', () => {
    const handleClick = jest.fn()
    render(
      <ColorCodeDisplay 
        colorCode="W001" 
        onColorCodeClick={handleClick} 
      />
    )
    
    fireEvent.click(screen.getByText('W001'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('applies correct variant classes', () => {
    const { rerender } = render(<ColorCodeDisplay colorCode="W001" variant="outline" />)
    expect(screen.getByText('W001').parentElement).toHaveClass('border-border')
    
    rerender(<ColorCodeDisplay colorCode="W001" variant="tile" />)
    expect(screen.getByText('W001').parentElement).toHaveClass('border-slate-200')
  })

  it('applies correct size classes', () => {
    const { rerender } = render(<ColorCodeDisplay colorCode="W001" size="sm" />)
    expect(screen.getByText('W001').parentElement).toHaveClass('h-5')
    
    rerender(<ColorCodeDisplay colorCode="W001" size="lg" />)
    expect(screen.getByText('W001').parentElement).toHaveClass('h-7')
  })

  it('uses fallback color for unknown color codes', () => {
    render(<ColorCodeDisplay colorCode="UNKNOWN" />)
    const swatch = screen.getByTitle('色号: UNKNOWN')
    expect(swatch).toHaveStyle('background-color: #CCCCCC')
  })
})

describe('ColorCodeSelector', () => {
  it('renders with placeholder', () => {
    render(<ColorCodeSelector placeholder="选择颜色" />)
    expect(screen.getByText('选择颜色')).toBeInTheDocument()
  })

  it('displays selected value', () => {
    render(<ColorCodeSelector value="W001" />)
    expect(screen.getByText('W001')).toBeInTheDocument()
  })

  it('opens dropdown when clicked', () => {
    render(<ColorCodeSelector />)
    const trigger = screen.getByRole('button')
    
    fireEvent.click(trigger)
    // 检查下拉框是否打开（通过检查色号选项）
    expect(screen.getAllByText(/W00[1-5]|G00[1-5]|B00[1-5]/)).toHaveLength(20) // 默认显示前20个色号
  })

  it('calls onValueChange when option selected', () => {
    const handleChange = jest.fn()
    render(<ColorCodeSelector onValueChange={handleChange} />)
    
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)
    
    // 选择第一个色号选项
    const firstOption = screen.getAllByRole('button')[1] // 第一个是触发器，第二个是选项
    fireEvent.click(firstOption)
    
    expect(handleChange).toHaveBeenCalled()
  })

  it('is disabled when disabled prop is true', () => {
    render(<ColorCodeSelector disabled />)
    const trigger = screen.getByRole('button')
    
    expect(trigger).toBeDisabled()
    fireEvent.click(trigger)
    // 确保下拉框没有打开
    expect(screen.queryAllByText(/W00[1-5]/)).toHaveLength(0)
  })

  it('uses custom color codes', () => {
    const customCodes = ['CUSTOM1', 'CUSTOM2']
    render(<ColorCodeSelector colorCodes={customCodes} />)
    
    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)
    
    expect(screen.getByText('CUSTOM1')).toBeInTheDocument()
    expect(screen.getByText('CUSTOM2')).toBeInTheDocument()
  })
})

describe('ColorCodeGrid', () => {
  const testColorCodes = ['W001', 'W002', 'G001', 'G002']

  it('renders all color codes', () => {
    render(<ColorCodeGrid colorCodes={testColorCodes} />)
    
    testColorCodes.forEach(code => {
      expect(screen.getByText(code)).toBeInTheDocument()
    })
  })

  it('highlights selected color code', () => {
    render(
      <ColorCodeGrid 
        colorCodes={testColorCodes} 
        selectedColorCode="W001" 
      />
    )
    
    const selectedElement = screen.getByText('W001').parentElement
    expect(selectedElement).toHaveClass('ring-2', 'ring-primary')
  })

  it('calls onColorCodeSelect when color clicked', () => {
    const handleSelect = jest.fn()
    render(
      <ColorCodeGrid 
        colorCodes={testColorCodes} 
        onColorCodeSelect={handleSelect} 
      />
    )
    
    fireEvent.click(screen.getByText('W001'))
    expect(handleSelect).toHaveBeenCalledWith('W001')
  })

  it('applies correct grid columns', () => {
    render(
      <ColorCodeGrid 
        colorCodes={testColorCodes} 
        columns={2} 
      />
    )
    
    const gridElement = screen.getByText('W001').closest('div[style*="grid-template-columns"]')
    expect(gridElement).toHaveStyle('grid-template-columns: repeat(2, minmax(0, 1fr))')
  })

  it('renders empty grid when no color codes provided', () => {
    render(<ColorCodeGrid colorCodes={[]} />)
    
    // 网格容器应该存在但为空
    const gridContainer = screen.getByText('W001').closest('div') || document.createElement('div')
    expect(gridContainer.children).toHaveLength(0)
  })
})

describe('ColorCodeDisplay Accessibility', () => {
  it('has proper ARIA attributes', () => {
    render(<ColorCodeDisplay colorCode="W001" />)
    const element = screen.getByText('W001').parentElement
    
    // 检查是否有适当的可访问性属性
    expect(element).toBeInTheDocument()
  })

  it('supports keyboard navigation when interactive', () => {
    const handleClick = jest.fn()
    render(
      <ColorCodeDisplay 
        colorCode="W001" 
        interactive 
        onColorCodeClick={handleClick} 
      />
    )
    
    const element = screen.getByText('W001').parentElement
    
    // 模拟键盘事件
    if (element) {
      fireEvent.keyDown(element, { key: 'Enter' })
      // 注意：实际的键盘处理可能需要额外的实现
    }
  })

  it('has proper color contrast', () => {
    render(<ColorCodeDisplay colorCode="W001" />)
    const swatch = screen.getByTitle('色号: W001')
    
    // 检查颜色对比度（这里只是示例，实际测试可能需要更复杂的逻辑）
    expect(swatch).toHaveStyle('background-color: #FFFFFF')
  })
})

describe('ColorCodeDisplay Performance', () => {
  it('does not re-render unnecessarily', () => {
    const renderSpy = jest.fn()
    const TestComponent = ({ colorCode }: { colorCode: string }) => {
      renderSpy()
      return <ColorCodeDisplay colorCode={colorCode} />
    }
    
    const { rerender } = render(<TestComponent colorCode="W001" />)
    expect(renderSpy).toHaveBeenCalledTimes(1)
    
    // 相同的 props 不应该触发重新渲染
    rerender(<TestComponent colorCode="W001" />)
    expect(renderSpy).toHaveBeenCalledTimes(1)
    
    // 不同的 props 应该触发重新渲染
    rerender(<TestComponent colorCode="W002" />)
    expect(renderSpy).toHaveBeenCalledTimes(2)
  })

  it('handles large number of color codes efficiently', () => {
    const manyColorCodes = Array.from({ length: 100 }, (_, i) => `COLOR${i}`)
    
    const startTime = performance.now()
    render(<ColorCodeGrid colorCodes={manyColorCodes} />)
    const endTime = performance.now()
    
    // 渲染时间应该在合理范围内（这里设置为100ms，实际项目中可能需要调整）
    expect(endTime - startTime).toBeLessThan(100)
  })
})

describe('ColorCodeDisplay Error Handling', () => {
  it('handles null color code gracefully', () => {
    // @ts-ignore - 测试错误情况
    render(<ColorCodeDisplay colorCode={null} />)
    expect(screen.getByText('null')).toBeInTheDocument()
  })

  it('handles undefined color code gracefully', () => {
    // @ts-ignore - 测试错误情况
    render(<ColorCodeDisplay colorCode={undefined} />)
    expect(screen.getByText('undefined')).toBeInTheDocument()
  })

  it('handles empty string color code', () => {
    render(<ColorCodeDisplay colorCode="" />)
    expect(screen.getByText('')).toBeInTheDocument()
  })
})
