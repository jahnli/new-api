/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useContext, useEffect, useState } from 'react';
import {
  Button,
  Typography,
  Input,
  ScrollList,
  ScrollItem,
} from '@douyinfe/semi-ui';
import { API, showError, copy, showSuccess } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { API_ENDPOINTS } from '../../constants/common.constant';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import {
  IconGithubLogo,
  IconPlay,
  IconFile,
  IconCopy,
} from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import NoticeModal from '../../components/layout/NoticeModal';
import {
  OpenAI,
  Zhipu,
  Claude,
  Gemini,
  Minimax,
  DeepSeek,
  Midjourney,
  Grok,
} from '@lobehub/icons';

const { Text } = Typography;

const orbitIcons = [
  { Component: DeepSeek.Color, angle: 0 },
  { Component: Zhipu.Color, angle: 120 },
  { Component: Minimax.Color, angle: 240 },
];
const orbitIconsOuter = [
  { Component: Claude.Color, angle: 0 },
  { Component: OpenAI, angle: 72 },
  { Component: Gemini.Color, angle: 144 },
  { Component: Grok, angle: 216 },
  { Component: Midjourney, angle: 288 },
];

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
  const docsLink = statusState?.status?.docs_link || '';
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;
  const endpointItems = API_ENDPOINTS.map((e) => ({ value: e }));
  const [endpointIndex, setEndpointIndex] = useState(0);
  const isChinese = i18n.language.startsWith('zh');

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (!data.startsWith('https://')) {
        content = marked.parse(data);
      }
      setHomePageContent(content);
      localStorage.setItem('home_page_content', content);

      if (data.startsWith('https://')) {
        const iframe = document.querySelector('iframe');
        if (iframe) {
          iframe.onload = () => {
            iframe.contentWindow.postMessage({ themeMode: actualTheme }, '*');
            iframe.contentWindow.postMessage({ lang: i18n.language }, '*');
          };
        }
      }
    } else {
      showError(message);
      setHomePageContent('加载首页内容失败...');
    }
    setHomePageContentLoaded(true);
  };

  const handleCopyBaseURL = async () => {
    const ok = await copy(serverAddress);
    if (ok) {
      showSuccess(t('已复制到剪切板'));
    }
  };

  useEffect(() => {
    const checkNoticeAndShow = async () => {
      const lastCloseDate = localStorage.getItem('notice_close_date');
      const today = new Date().toDateString();
      if (lastCloseDate !== today) {
        try {
          const res = await API.get('/api/notice');
          const { success, data } = res.data;
          if (success && data && data.trim() !== '') {
            setNoticeVisible(true);
          }
        } catch (error) {
          console.error('获取公告失败:', error);
        }
      }
    };

    checkNoticeAndShow();
  }, []);

  useEffect(() => {
    displayHomePageContent().then();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setEndpointIndex((prev) => (prev + 1) % endpointItems.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [endpointItems.length]);

  const renderOrbitDots = (icons, radius) =>
    icons.map(({ Component, angle }, i) => {
      const rad = (angle * Math.PI) / 180;
      const x = radius * Math.cos(rad);
      const y = radius * Math.sin(rad);
      return (
        <div
          key={i}
          className='home-orbit-dot'
          style={{
            top: `calc(50% + ${y}px - 22px)`,
            left: `calc(50% + ${x}px - 22px)`,
            animation: 'none',
          }}
        >
          <Component size={26} />
        </div>
      );
    });

  return (
    <div className='w-full overflow-x-hidden'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />
      {homePageContentLoaded && homePageContent === '' ? (
        <div className='w-full overflow-x-hidden'>
          {/* ====== Hero Section ====== */}
          <div className='w-full min-h-[500px] md:min-h-[600px] lg:min-h-[680px] relative overflow-hidden'>
            <div className='blur-ball blur-ball-indigo' />
            <div className='blur-ball blur-ball-teal' />
            <div className='home-dotgrid' />

            <div className='flex items-center justify-center h-full px-4 py-4 md:py-6 lg:py-8 relative z-10'>
              <div className='flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-20 max-w-6xl mx-auto w-full'>

                {/* 左侧文字 */}
                <div className='flex flex-col items-center lg:items-start text-center lg:text-left max-w-xl flex-1'>
                  <h1
                    className={`home-reveal text-4xl md:text-5xl lg:text-6xl font-bold text-semi-color-text-0 leading-tight ${isChinese ? 'tracking-wide' : ''}`}
                  >
                    <span className='shine-text'>{t('统一大模型接口网关')}</span>
                  </h1>

                  <p className='home-reveal home-reveal-d1 text-base md:text-lg text-semi-color-text-2 mt-4 md:mt-5 max-w-md'>
                    {t('只需模型基址替换为：')}
                  </p>

                  <div className='home-reveal home-reveal-d2 flex items-center gap-3 w-full mt-4 max-w-md'>
                    <Input
                      readonly
                      value={serverAddress}
                      className='flex-1 !rounded-full'
                      size={isMobile ? 'default' : 'large'}
                      suffix={
                        <div className='flex items-center gap-2'>
                          <ScrollList
                            bodyHeight={32}
                            style={{ border: 'unset', boxShadow: 'unset' }}
                          >
                            <ScrollItem
                              mode='wheel'
                              cycled={true}
                              list={endpointItems}
                              selectedIndex={endpointIndex}
                              onSelect={({ index }) => setEndpointIndex(index)}
                            />
                          </ScrollList>
                          <Button
                            type='primary'
                            onClick={handleCopyBaseURL}
                            icon={<IconCopy />}
                            className='!rounded-full'
                          />
                        </div>
                      }
                    />
                  </div>

                  <div className='home-reveal home-reveal-d3 flex flex-row gap-3 mt-6'>
                    <Link to='/console'>
                      <Button
                        theme='solid'
                        type='primary'
                        size={isMobile ? 'default' : 'large'}
                        className='!rounded-3xl px-8 py-2 home-glow-btn'
                        icon={<IconPlay />}
                      >
                        {t('获取密钥')}
                      </Button>
                    </Link>
                    {isDemoSiteMode && statusState?.status?.version ? (
                      <Button
                        size={isMobile ? 'default' : 'large'}
                        className='flex items-center !rounded-3xl px-6 py-2'
                        icon={<IconGithubLogo />}
                        onClick={() =>
                          window.open(
                            'https://github.com/QuantumNous/new-api',
                            '_blank',
                          )
                        }
                      >
                        {statusState.status.version}
                      </Button>
                    ) : (
                      docsLink && (
                        <Button
                          size={isMobile ? 'default' : 'large'}
                          className='flex items-center !rounded-3xl px-6 py-2'
                          icon={<IconFile />}
                          onClick={() => window.open(docsLink, '_blank')}
                        >
                          {t('文档')}
                        </Button>
                      )
                    )}
                  </div>
                </div>

                {/* 右侧：轨道动画（桌面端）*/}
                {!isMobile && (
                  <div className='flex-1 flex flex-col items-center justify-center w-full max-w-lg'>
                    <div className='relative w-[520px] h-[520px] flex items-center justify-center'>
                      <div className='home-orbit-ring home-orbit-ring-inner' style={{ top: '36%', left: '40%', transform: 'translate(-50%, -50%)' }}>
                        {renderOrbitDots(orbitIcons, 170)}
                      </div>
                      <div className='home-orbit-ring home-orbit-ring-outer' style={{ top: 'calc(36% + 60px)', left: '50%', transform: 'translate(-50%, -50%)' }}>
                        {renderOrbitDots(orbitIconsOuter, 200)}
                      </div>
                      {/* 轨道中心数字 */}
                      <div className='home-orbit-center'>
                        <span className='home-orbit-center-num'>100+</span>
                        <span className='home-orbit-center-label'>MODELS</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 终端代码块 */}
            <div className='max-w-6xl mx-auto -mt-20 pb-10 relative z-10'>
              <div className='home-terminal w-full max-w-xl home-reveal home-reveal-d3'>
                <div className='home-terminal-bar'>
                  <div className='home-terminal-circle' style={{ background: '#ff5f57' }} />
                  <div className='home-terminal-circle' style={{ background: '#febc2e' }} />
                  <div className='home-terminal-circle' style={{ background: '#28c840' }} />
                  <span style={{ marginLeft: 8, fontSize: 11, color: '#6b7280' }}>api.sh</span>
                </div>
                <div className='home-terminal-body'>
                  <div><span className='t-comment'>{'# quick start'}</span></div>
                  <div>
                    <span className='t-keyword'>export </span>
                    <span className='t-const'>BASE_URL</span>
                    <span className='t-punct'>=</span>
                    <span className='t-string'>"{serverAddress}"</span>
                  </div>
                  <div style={{ height: 6 }} />
                  <div>
                    <span className='t-func'>curl </span>
                    <span className='t-string'>$BASE_URL/v1/chat/completions</span>
                  </div>
                  <div>
                    {'  '}<span className='t-punct'>-H </span>
                    <span className='t-string'>"Authorization: Bearer $KEY"</span>
                  </div>
                  <div>
                    {'  '}<span className='t-punct'>-d </span>
                    <span className='t-string'>{'\'{"model":"MODEL_NAME"}\''}</span>
                    <span className='home-caret' />
                  </div>
                </div>
              </div>
            </div>

            {/* ====== 两步接入区域 ====== */}
            <div className='home-steps-section w-full py-14 md:py-20'>
              <div className='max-w-4xl mx-auto px-4'>
                <div className='text-center mb-10 md:mb-14'>
                  <h2 className='home-reveal text-2xl md:text-3xl font-bold text-semi-color-text-0'>
                    {t('两步，三分钟完成全部接入')}
                  </h2>
                  <p className='home-reveal home-reveal-d1 mt-2 text-semi-color-text-2'>
                    {t('保持你熟悉的 OpenAI 接入方式。')}
                  </p>
                </div>

                <div className='flex flex-col lg:flex-row items-stretch gap-0'>
                  {/* Step 1 */}
                  <div className='home-step-card home-reveal home-reveal-d1 flex-1'>
                    <div className='home-step-flow-line' />
                    <div className='flex items-start gap-4'>
                      <div className='home-step-number'>1</div>
                      <div className='flex-1 min-w-0'>
                        <h3 className='text-base font-semibold text-semi-color-text-0 mb-1.5'>
                          {t('注册账号，获取 API Key')}
                        </h3>
                        <p className='text-sm text-semi-color-text-2 leading-relaxed'>
                          {t('进入')}{' '}
                          <Link to='/console' className='text-semi-color-primary font-medium'>{t('控制台')}</Link>
                          {' '}{t('完成注册，在令牌管理中创建新令牌并复制备用')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 中间脉冲弧线 */}
                  <div className='home-step-bridge'>
                    <svg className='home-step-bridge-svg' viewBox={isMobile ? '0 0 48 56' : '0 0 80 48'}>
                      {isMobile ? (
                        <path className='bridge-path' d='M24 4 C36 16, 12 40, 24 52' />
                      ) : (
                        <path className='bridge-path' d='M4 24 C24 6, 56 42, 76 24' />
                      )}
                    </svg>
                  </div>

                  {/* Step 2 */}
                  <div className='home-step-card home-reveal home-reveal-d2 flex-1'>
                    <div className='home-step-flow-line' />
                    <div className='flex items-start gap-4'>
                      <div className='home-step-number'>2</div>
                      <div className='flex-1 min-w-0'>
                        <h3 className='text-base font-semibold text-semi-color-text-0 mb-1.5'>
                          {t('替换 Base URL 开始调用')}
                        </h3>
                        <p className='text-sm text-semi-color-text-2 leading-relaxed'>
                          {t('将客户端或代码中的接口地址改为')}{' '}
                          <code className='text-semi-color-primary text-xs font-mono bg-semi-color-fill-0 px-1.5 py-0.5 rounded'>{serverAddress}</code>
                          {t('，其余配置保持不变。')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ====== 联系方式 ====== */}
            <div className='w-full pb-14 md:pb-20'>
              <div className='max-w-4xl mx-auto px-4 flex justify-center'>
                <a
                  href='https://applink.feishu.cn/client/chat/open?openId=ou_xxxx'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='group flex items-center gap-3 px-5 py-3 rounded-2xl bg-semi-color-bg-2 border border-semi-color-fill-2 hover:shadow-lg hover:border-semi-color-primary transition-all duration-300'
                >
                  <img
                    src='https://p1-hera.feishucdn.com/tos-cn-i-jbbdkfciu3/1ec7129d900e442d8501d810efdaa369~tplv-jbbdkfciu3-image:0:0.image'
                    alt='Feishu'
                    className='w-9 h-9 rounded-xl object-cover flex-shrink-0'
                  />
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium text-semi-color-text-0 group-hover:text-semi-color-primary transition-colors'>{t('工程效率部 · 李佳衡')}</span>
                    <span className='text-xs text-semi-color-text-2'>{t('遇到问题？飞书聊一聊')}</span>
                  </div>
                  <svg className='w-4 h-4 text-semi-color-text-2 group-hover:text-semi-color-primary group-hover:translate-x-0.5 transition-all ml-1' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                    <path d='M5 12h14M12 5l7 7-7 7'/>
                  </svg>
                </a>
              </div>
            </div>

            {/* 模型图标行（移动端展示） */}
            {isMobile && (
              <div className='pb-8 px-4'>
                <div className='flex items-center mb-4 justify-center'>
                  <Text type='tertiary' className='!text-sm font-light'>
                    {t('支持全球主流大语言模型')}
                  </Text>
                </div>
                <div className='flex flex-wrap items-center justify-center gap-3'>
                  {[Claude.Color, OpenAI, Gemini.Color, Grok, DeepSeek.Color, Zhipu.Color, Minimax.Color].map(
                    (Icon, i) => (
                      <div key={i} className='w-8 h-8 flex items-center justify-center'>
                        <Icon size={28} />
                      </div>
                    ),
                  )}
                  <Text className='!text-lg font-bold'>100+</Text>
                </div>
              </div>
            )}
          </div>

        </div>
      ) : (
        <div className='overflow-x-hidden w-full'>
          {homePageContent.startsWith('https://') ? (
            <iframe
              src={homePageContent}
              className='w-full h-screen border-none'
            />
          ) : (
            <div
              className='mt-[60px]'
              dangerouslySetInnerHTML={{ __html: homePageContent }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
