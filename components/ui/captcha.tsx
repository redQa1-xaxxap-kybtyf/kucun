'use client';

import { RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CaptchaProps {
  width?: number;
  height?: number;
  length?: number;
  onCaptchaChange?: (captcha: string) => void;
  className?: string;
}

// 生成随机字符串（排除容易混淆的字符）
const generateCaptcha = (length: number): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// 生成随机颜色
const getRandomColor = (min: number = 0, max: number = 255): string => {
  const r = Math.floor(Math.random() * (max - min + 1)) + min;
  const g = Math.floor(Math.random() * (max - min + 1)) + min;
  const b = Math.floor(Math.random() * (max - min + 1)) + min;
  return `rgb(${r},${g},${b})`;
};

export const Captcha = React.forwardRef<HTMLCanvasElement, CaptchaProps>(
  (
    { width = 120, height = 40, length = 4, onCaptchaChange, className },
    _ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [captchaText, setCaptchaText] = useState('');

    // 使用 useRef 来存储回调函数，避免依赖数组问题
    const onCaptchaChangeRef = useRef(onCaptchaChange);

    // 更新回调函数引用
    useEffect(() => {
      onCaptchaChangeRef.current = onCaptchaChange;
    }, [onCaptchaChange]);

    // 绘制验证码 - 移除 onCaptchaChange 依赖，使用 ref 访问
    const drawCaptcha = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 生成新的验证码文本
      const newCaptcha = generateCaptcha(length);

      // 清空画布
      ctx.clearRect(0, 0, width, height);

      // 设置背景色
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, width, height);

      // 绘制干扰线
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = getRandomColor(100, 200);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.lineTo(Math.random() * width, Math.random() * height);
        ctx.stroke();
      }

      // 绘制干扰点
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = getRandomColor(150, 200);
        ctx.beginPath();
        ctx.arc(
          Math.random() * width,
          Math.random() * height,
          Math.random() * 2,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }

      // 绘制验证码文字
      const fontSize = Math.floor(height * 0.6);
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textBaseline = 'middle';

      const charWidth = width / length;
      for (let i = 0; i < newCaptcha.length; i++) {
        const char = newCaptcha[i];

        // 随机颜色
        ctx.fillStyle = getRandomColor(20, 100);

        // 随机位置和角度
        const x = charWidth * i + charWidth / 2;
        const y = height / 2 + (Math.random() - 0.5) * 8;
        const angle = (Math.random() - 0.5) * 0.4;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillText(char, -ctx.measureText(char).width / 2, 0);
        ctx.restore();
      }

      // 绘制边框
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, width, height);

      // 在绘制完成后更新状态和调用回调
      setCaptchaText(newCaptcha);
      onCaptchaChangeRef.current?.(newCaptcha);
    }, [width, height, length]); // 移除 onCaptchaChange 依赖

    // 刷新验证码
    const refreshCaptcha = useCallback(() => {
      drawCaptcha();
    }, [drawCaptcha]);

    // 初始化绘制 - 只在组件挂载时执行一次
    useEffect(() => {
      drawCaptcha();
    }, []); // 空依赖数组，只在挂载时执行

    // 当尺寸或长度变化时重新绘制
    useEffect(() => {
      if (captchaText) {
        // 只有在已经初始化后才重新绘制
        drawCaptcha();
      }
    }, [width, height, length, drawCaptcha]);

    return (
      <div className={cn('flex items-center gap-2', className)}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="cursor-pointer rounded border border-input"
          onClick={refreshCaptcha}
          title="点击刷新验证码"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refreshCaptcha}
          className="h-10 px-3"
          title="刷新验证码"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    );
  }
);

Captcha.displayName = 'Captcha';

// 验证码验证函数
export const verifyCaptcha = (
  userInput: string,
  correctCaptcha: string
): boolean => userInput.toUpperCase() === correctCaptcha.toUpperCase();
