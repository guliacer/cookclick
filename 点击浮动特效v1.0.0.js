// ==UserScript==
// @name         点击浮动特效（V1.4.0 中文变量版）
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  Configurable click float effect with Chinese config.
// @author       You
// @match        *://*/*
// @grant        none
// @run-at       document-start
// @unwrap       true
// ==/UserScript==

(function () {
    'use strict';

    const 全局标记 = '__clickFloatEffectStableV140__';
    const 样式ID = 'click-float-effect-style';

    // =========================
    // 可调配置区
    // 只改这里，一般不需要动下面的核心逻辑
    // =========================
    const 配置 = Object.freeze({
        // 页面上同时存在的特效元素上限，防止高频点击时堆积太多 DOM
        最大活跃元素数: 32,

        // 字体大小范围 [最小值, 最大值]
        大小范围: [18, 30],

        // 动画时长范围（毫秒）[最短, 最长]
        时长范围毫秒: [1350, 2350],

        // 同一次“连发”时，每个特效相对点击点的随机散开范围
        横向散开范围: [-14, 14],
        纵向散开范围: [-10, 10],

        // 漂浮轨迹的附加随机偏移范围
        漂移横向抖动范围: [-10, 10],
        漂移纵向抖动范围: [-14, 14],

        // 初始旋转角度范围、结束旋转附加抖动范围
        初始旋转范围: [-8, 8],
        结束旋转抖动范围: [-8, 8],

        // 消失时透明度范围、入场缩放范围、离场缩放附加变化范围
        消失透明度范围: [0, 0.12],
        入场缩放范围: [0.88, 1.02],
        离场缩放抖动范围: [-0.03, 0.08],

        // 连发数量权重：count 越大越热闹，weight 越大越容易出现
        连发配置: [
            { 数量: 1, 权重: 56 },
            { 数量: 2, 权重: 32 },
            { 数量: 3, 权重: 12 }
        ],

        // 启用的素材分类：可按需删掉某类，或调整顺序
        启用分类: ['爱心系', '闪光系', '可爱Emoji', '颜文字'],

        // 分类出现权重：数值越大，越容易抽到该分类
        分类权重: {
            爱心系: 24,
            闪光系: 20,
            可爱Emoji: 26,
            颜文字: 30
        }
    });

    const 移除缓冲毫秒 = 400;
    const 最大动画时长毫秒 = 配置.时长范围毫秒[1];

    if (window[全局标记]) {
        return;
    }
    window[全局标记] = true;

    // 素材池：想增加内容时，直接往对应数组里加即可
    const 素材池 = Object.freeze({
        // 爱心系
        爱心系: Object.freeze([
            '❤', '🧡', '💛', '💚', '💙', '💜', '🩷', '🤍', '🤎',
            '💖', '💗', '💘', '💝', '💞', '💕', '💓'
        ]),
        // 闪光/花朵/轻装饰
        闪光系: Object.freeze([
            '✨', '⭐', '🌟', '💫', '☁️', '🫧', '🌸', '🎀', '🦋', '🌈', '🍀'
        ]),
        // 可爱 emoji
        可爱Emoji: Object.freeze([
            '🥰', '😍', '😘', '😚', '😊', '😆', '😄', '😺', '😻', '🙌', '🎉'
        ]),
        // 颜文字 / 表情文字
        颜文字: Object.freeze([
            'ദ്ദി(˵•̀ ᴗ -˵)✧',
            '(｡･ω･｡)',
            '(๑•̀ㅂ•́)و✧',
            '(✿◠‿◠)',
            '( •̀ .̫ •́ )✧',
            '(≧▽≦)',
            '(๑˃ᴗ˂)ﻭ',
            '(๑•ᴗ•๑)',
            '(ﾉ>ω<)ﾉ',
            '(づ｡◕‿‿◕｡)づ',
            'ヽ(✿ﾟ▽ﾟ)ノ',
            '(つ≧▽≦)つ',
            '(ฅ´ω`ฅ)',
            '(●ˇ∀ˇ●)',
            '(⁄ ⁄•⁄ω⁄•⁄ ⁄)',
            '(≧ω≦)/'
        ])
    });

    // 每类素材使用一组偏柔和的颜色
    const 分类颜色 = Object.freeze({
        爱心系: Object.freeze(['#D7A2A9', '#E5B1B9', '#D6A7BF', '#CFA0A7']),
        闪光系: Object.freeze(['#DCC8A1', '#CDBB94', '#E1D2B8', '#D4C6A8']),
        可爱Emoji: Object.freeze(['#B7B09C', '#C9B79C', '#D9C5B4', '#C9BDB0']),
        颜文字: Object.freeze(['#A8B0AC', '#B8C4BB', '#AEB7B3', '#C8BFC7', '#AFA79A'])
    });

    const 缓动函数列表 = Object.freeze([
        'cubic-bezier(0.22, 1, 0.36, 1)',
        'cubic-bezier(0.18, 0.89, 0.32, 1.12)',
        'cubic-bezier(0.25, 0.8, 0.25, 1)',
        'cubic-bezier(0.16, 1, 0.3, 1)'
    ]);

    // 基础运动轨迹模板：最终还会叠加随机偏移，所以不会显得死板
    const 轨迹模板 = Object.freeze([
        { 漂移X: 0, 漂移Y: -78, 旋转: 0, 缩放: 1.08 },
        { 漂移X: -22, 漂移Y: -86, 旋转: -10, 缩放: 1.1 },
        { 漂移X: 24, 漂移Y: -82, 旋转: 12, 缩放: 1.06 },
        { 漂移X: -34, 漂移Y: -72, 旋转: -18, 缩放: 1.04 },
        { 漂移X: 36, 漂移Y: -94, 旋转: 16, 缩放: 1.12 },
        { 漂移X: 8, 漂移Y: -108, 旋转: 6, 缩放: 1.15 }
    ]);

    const 活跃元素集合 = new Set();
    let 清理定时器ID = 0;

    function 确保样式() {
        if (document.getElementById(样式ID)) {
            return;
        }

        const style = document.createElement('style');
        style.id = 样式ID;
        style.textContent = `
            .click-float-effect {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                z-index: 2147483647 !important;
                pointer-events: none !important;
                user-select: none !important;
                opacity: 1 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: 0 !important;
                background: transparent !important;
                line-height: 1 !important;
                white-space: nowrap !important;
                will-change: transform, opacity !important;
                filter: drop-shadow(0 1px 2px rgba(255, 255, 255, 0.18)) !important;
                transform: translate3d(var(--x), var(--y), 0)
                    translate(-50%, -50%)
                    rotate(var(--初始旋转, 0deg))
                    scale(var(--入场缩放, 0.98)) !important;
                transition:
                    transform var(--时长, 1800ms) var(--缓动, ease-out),
                    opacity var(--时长, 1800ms) ease-out !important;
            }

            .click-float-effect.is-leaving {
                opacity: var(--消失透明度, 0) !important;
                transform: translate3d(
                        calc(var(--x) + var(--漂移X, 0px)),
                        calc(var(--y) + var(--漂移Y, -80px)),
                        0
                    )
                    translate(-50%, -50%)
                    rotate(var(--结束旋转, 0deg))
                    scale(var(--离场缩放, 1.08)) !important;
            }
        `;

        const 根节点 = document.head || document.documentElement;
        if (根节点) {
            根节点.appendChild(style);
        }
    }

    function 获取挂载节点() {
        return document.body || document.documentElement;
    }

    function 随机小数(最小值, 最大值) {
        return 最小值 + Math.random() * (最大值 - 最小值);
    }

    function 随机整数(最小值, 最大值) {
        return Math.floor(随机小数(最小值, 最大值 + 1));
    }

    function 随机取项(列表) {
        return 列表[Math.floor(Math.random() * 列表.length)];
    }

    function 按权重随机取项(列表) {
        let 总权重 = 0;

        for (const 项 of 列表) {
            总权重 += 项.权重;
        }

        let 随机值 = Math.random() * 总权重;

        for (const 项 of 列表) {
            随机值 -= 项.权重;
            if (随机值 <= 0) {
                return 项.值;
            }
        }

        return 列表[列表.length - 1].值;
    }

    function 获取启用分类() {
        return 配置.启用分类.filter((分类) => {
            return Array.isArray(素材池[分类]) && 素材池[分类].length > 0;
        });
    }

    // 按权重抽取一个素材分类
    function 抽取分类() {
        const 启用分类列表 = 获取启用分类();
        const 分类权重列表 = 启用分类列表.map((分类) => ({
            值: 分类,
            权重: Math.max(1, 配置.分类权重[分类] || 1)
        }));

        return 按权重随机取项(分类权重列表);
    }

    // 按权重决定这次点击生成几个特效
    function 抽取连发数量() {
        const 连发权重列表 = 配置.连发配置.map((项) => ({
            值: 项.数量,
            权重: Math.max(1, 项.权重 || 1)
        }));

        return 按权重随机取项(连发权重列表);
    }

    // 组合出一次特效所需的完整随机参数
    function 构建特效配置() {
        const 分类 = 抽取分类();
        const 模板 = 随机取项(轨迹模板);
        const 颜色池 = 分类颜色[分类] || 分类颜色.可爱Emoji;

        return {
            文本: 随机取项(素材池[分类]),
            颜色: 随机取项(颜色池),
            字号: 随机整数(配置.大小范围[0], 配置.大小范围[1]),
            时长: 随机整数(配置.时长范围毫秒[0], 配置.时长范围毫秒[1]),
            缓动: 随机取项(缓动函数列表),
            入场缩放: 随机小数(配置.入场缩放范围[0], 配置.入场缩放范围[1]).toFixed(2),
            离场缩放: (
                模板.缩放 + 随机小数(配置.离场缩放抖动范围[0], 配置.离场缩放抖动范围[1])
            ).toFixed(2),
            漂移X: 模板.漂移X + 随机整数(配置.漂移横向抖动范围[0], 配置.漂移横向抖动范围[1]),
            漂移Y: 模板.漂移Y + 随机整数(配置.漂移纵向抖动范围[0], 配置.漂移纵向抖动范围[1]),
            初始旋转: 随机整数(配置.初始旋转范围[0], 配置.初始旋转范围[1]),
            结束旋转: 模板.旋转 + 随机整数(配置.结束旋转抖动范围[0], 配置.结束旋转抖动范围[1]),
            消失透明度: 随机小数(配置.消失透明度范围[0], 配置.消失透明度范围[1]).toFixed(2)
        };
    }

    function 安排清理巡检() {
        if (清理定时器ID) {
            window.clearTimeout(清理定时器ID);
        }

        清理定时器ID = window.setTimeout(() => {
            清理定时器ID = 0;

            for (const 元素 of Array.from(活跃元素集合)) {
                if (!元素.isConnected) {
                    活跃元素集合.delete(元素);
                }
            }
        }, 最大动画时长毫秒 + 移除缓冲毫秒 + 50);
    }

    function 移除特效(元素) {
        if (!元素) {
            return;
        }

        活跃元素集合.delete(元素);

        if (元素.parentNode) {
            元素.parentNode.removeChild(元素);
        }
    }

    function 限制元素数量() {
        while (活跃元素集合.size >= 配置.最大活跃元素数) {
            const 最旧元素 = 活跃元素集合.values().next().value;
            移除特效(最旧元素);
        }
    }

    // 创建单个漂浮元素
    function 创建特效(x, y, 特效配置) {
        const 挂载节点 = 获取挂载节点();
        if (!挂载节点) {
            return;
        }

        确保样式();
        限制元素数量();

        const 元素 = document.createElement('span');
        元素.className = 'click-float-effect';
        元素.textContent = 特效配置.文本;
        元素.style.setProperty('--x', `${x}px`);
        元素.style.setProperty('--y', `${y}px`);
        元素.style.setProperty('--漂移X', `${特效配置.漂移X}px`);
        元素.style.setProperty('--漂移Y', `${特效配置.漂移Y}px`);
        元素.style.setProperty('--时长', `${特效配置.时长}ms`);
        元素.style.setProperty('--缓动', 特效配置.缓动);
        元素.style.setProperty('--入场缩放', 特效配置.入场缩放);
        元素.style.setProperty('--离场缩放', 特效配置.离场缩放);
        元素.style.setProperty('--初始旋转', `${特效配置.初始旋转}deg`);
        元素.style.setProperty('--结束旋转', `${特效配置.结束旋转}deg`);
        元素.style.setProperty('--消失透明度', 特效配置.消失透明度);
        元素.style.fontSize = `${特效配置.字号}px`;
        元素.style.color = 特效配置.颜色;
        元素.style.fontFamily = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Arial, sans-serif';

        const 延迟移除 = window.setTimeout(() => {
            移除特效(元素);
        }, 特效配置.时长 + 移除缓冲毫秒);

        元素.addEventListener('transitionend', (事件) => {
            if (事件.propertyName === 'opacity') {
                window.clearTimeout(延迟移除);
                移除特效(元素);
            }
        }, { once: true });

        挂载节点.appendChild(元素);
        活跃元素集合.add(元素);

        window.requestAnimationFrame(() => {
            if (!元素.isConnected) {
                return;
            }

            元素.classList.add('is-leaving');
        });

        安排清理巡检();
    }

    // 一次点击可生成 1~3 个特效，形成更丰富的随机效果
    function 生成特效组(x, y) {
        const 连发数量 = 抽取连发数量();

        for (let 索引 = 0; 索引 < 连发数量; 索引 += 1) {
            const 特效配置 = 构建特效配置();
            const 偏移X = 连发数量 === 1 ? 0 : 随机整数(配置.横向散开范围[0], 配置.横向散开范围[1]);
            const 偏移Y = 连发数量 === 1 ? 0 : 随机整数(配置.纵向散开范围[0], 配置.纵向散开范围[1]);
            const 延迟 = 索引 * 随机整数(24, 64);

            window.setTimeout(() => {
                创建特效(x + 偏移X, y + 偏移Y, 特效配置);
            }, 延迟);
        }
    }

    function 处理点击(事件) {
        if (!事件 || !Number.isFinite(事件.clientX) || !Number.isFinite(事件.clientY)) {
            return;
        }

        生成特效组(事件.clientX, 事件.clientY);
    }

    确保样式();
    window.addEventListener('click', 处理点击, { capture: true, passive: true });
})();
