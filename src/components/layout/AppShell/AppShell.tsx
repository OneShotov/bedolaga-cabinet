import { useEffect, useState, useRef } from 'react';
import { useLocation, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { useAuthStore } from '@/store/auth';
import { useHaptic } from '@/platform';
import { useTelegramSDK } from '@/hooks/useTelegramSDK';
import { useHeaderHeight } from '@/hooks/useHeaderHeight';
import { useTheme } from '@/hooks/useTheme';
import { useBranding } from '@/hooks/useBranding';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { themeColorsApi } from '@/api/themeColors';
import { isLogoPreloaded } from '@/api/branding';
import { cn } from '@/lib/utils';

import WebSocketNotifications from '@/components/WebSocketNotifications';
import CampaignBonusNotifier from '@/components/CampaignBonusNotifier';
import SuccessNotificationModal from '@/components/SuccessNotificationModal';
import { PromptDialogHost } from '@/components/PromptDialogHost';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import TicketNotificationBell from '@/components/TicketNotificationBell';
import {
  SubscriptionIcon,
  GiftIcon,
  HomeIcon,
  CreditCardIcon,
  ChatIcon,
  UserIcon,
  UsersIcon,
  ShieldIcon,
  InfoIcon,
  LogoutIcon,
  SunIcon,
  MoonIcon,
} from '@/components/icons';

import { MobileBottomNav } from './MobileBottomNav';
import { AppHeader } from './AppHeader';
import { BackgroundRenderer } from '@/components/backgrounds/BackgroundRenderer';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const logout = useAuthStore((state) => state.logout);
  const { isFullscreen, safeAreaInset, contentSafeAreaInset, platform, isMobile } =
    useTelegramSDK();
  const { mobile: headerHeight } = useHeaderHeight();
  const haptic = useHaptic();
  const { toggleTheme, isDark } = useTheme();

  // Extracted hooks
  const { appName, logoLetter, hasCustomLogo, logoUrl } = useBranding();
  const { referralEnabled, wheelEnabled, hasContests, hasPolls, giftEnabled } = useFeatureFlags();
  useScrollRestoration();

  // Theme toggle visibility
  const { data: enabledThemes } = useQuery({
    queryKey: ['enabled-themes'],
    queryFn: themeColorsApi.getEnabledThemes,
    staleTime: 1000 * 60 * 5,
  });
  const canToggleTheme = enabledThemes?.dark && enabledThemes?.light;

  // Only apply fullscreen UI adjustments on mobile Telegram (iOS/Android)
  const isMobileFullscreen = isFullscreen && isMobile;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Reset keyboard state on route change — prevents bottom nav staying hidden after navigation
  useEffect(() => {
    setIsKeyboardOpen(false);
  }, [location.pathname]);

  // Keyboard detection for hiding bottom nav
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      if (
        !relatedTarget ||
        (relatedTarget.tagName !== 'INPUT' &&
          relatedTarget.tagName !== 'TEXTAREA' &&
          !relatedTarget.isContentEditable)
      ) {
        setIsKeyboardOpen(false);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // Desktop navigation — labels always visible (no hover-reveal gimmick)
  const desktopNav = [
    { path: '/', label: t('nav.dashboard'), icon: HomeIcon },
    { path: '/subscriptions', label: t('nav.subscription'), icon: SubscriptionIcon },
    { path: '/balance', label: t('nav.balance'), icon: CreditCardIcon },
    ...(referralEnabled ? [{ path: '/referral', label: t('nav.referral'), icon: UsersIcon }] : []),
    ...(giftEnabled ? [{ path: '/gift', label: t('nav.gift'), icon: GiftIcon }] : []),
    { path: '/support', label: t('nav.support'), icon: ChatIcon },
    { path: '/info', label: t('nav.info'), icon: InfoIcon },
    { path: '/profile', label: t('nav.profile'), icon: UserIcon },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNavClick = () => {
    haptic.impact('light');
  };

  // A single elegant nav link: icon + label always visible, with a shared
  // framer-motion pill that slides to the active item on navigation.
  const renderNavLink = (
    path: string,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    admin = false,
  ) => {
    const active = admin ? location.pathname.startsWith('/admin') : isActive(path);
    return (
      <Link
        key={path}
        to={path}
        onClick={handleNavClick}
        {...(path === '/profile' ? { 'data-onboarding': 'profile-anchor' } : {})}
        aria-label={label}
        className={cn(
          'relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-200',
          active
            ? admin
              ? 'text-warning-300'
              : 'text-dark-50'
            : admin
              ? 'text-warning-500/70 hover:bg-warning-500/10 hover:text-warning-300'
              : 'text-dark-400 hover:bg-dark-800/60 hover:text-dark-100',
        )}
      >
        {active && (
          <motion.span
            layoutId="desktop-nav-active"
            className={cn(
              // Подсветка-пилюля активного пункта — «приподнята» над треком капсулы
              'absolute inset-0 rounded-full shadow-sm',
              admin
                ? 'bg-warning-500/15 ring-1 ring-warning-500/20'
                : 'bg-dark-700/80 ring-1 ring-dark-600/40',
            )}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
        <Icon className="relative h-4 w-4 shrink-0" />
        <span className="relative whitespace-nowrap">{label}</span>
      </Link>
    );
  };

  // headerHeight comes from useHeaderHeight() — accounts for TG safe area in fullscreen

  return (
    <div className="min-h-viewport">
      {/* Animated background renders via portal on document.body at z-index: -1 */}
      <BackgroundRenderer />

      {/* Global components */}
      <WebSocketNotifications />
      <CampaignBonusNotifier />
      <SuccessNotificationModal />
      <PromptDialogHost />

      {/* Desktop Header */}
      <header className="fixed left-0 right-0 top-0 z-50 hidden border-b border-dark-800/50 bg-dark-950/95 lg:block">
        {/* 3-зонный grid: лого | капсула | действия. Колонки 1fr_auto_1fr держат
            капсулу строго по центру вьюпорта НЕЗАВИСИМО от ширины лого/действий,
            а действия — у правого края. Поэтому ничего не «скачет» при переходах
            (в т.ч. в админку): смена ширины в одной зоне не двигает другие. */}
        <div className="mx-auto grid h-14 max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-6">
          {/* Logo */}
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5 justify-self-start"
            onClick={handleNavClick}
          >
            <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-dark-800">
              <span
                className={cn(
                  'absolute text-sm font-bold text-accent-400 transition-opacity duration-200',
                  hasCustomLogo && isLogoPreloaded() ? 'opacity-0' : 'opacity-100',
                )}
              >
                {logoLetter}
              </span>
              {hasCustomLogo && logoUrl && (
                <img
                  src={logoUrl}
                  alt={appName || 'Logo'}
                  className={cn(
                    'absolute h-full w-full object-contain transition-opacity duration-200',
                    isLogoPreloaded() ? 'opacity-100' : 'opacity-0',
                  )}
                />
              )}
            </div>
            <span className="text-base font-semibold text-dark-100">{appName}</span>
          </Link>

          {/* Navigation — единая «капсула» (segmented control): все пункты видны
              всегда, без скролла/сжатия/сворачивания. Центрируется средней
              колонкой grid (justify-self-center), а не auto-margin'ами. */}
          <nav className="flex items-center gap-0.5 justify-self-center rounded-full border border-dark-800/70 bg-dark-900/50 p-1 shadow-sm backdrop-blur-sm">
            {desktopNav.map((item) => renderNavLink(item.path, item.label, item.icon))}
            {isAdmin && (
              <>
                <div className="mx-1 h-5 w-px shrink-0 bg-dark-700/60" />
                {renderNavLink('/admin', t('admin.nav.title'), ShieldIcon, true)}
              </>
            )}
          </nav>

          {/* Right side actions — правая колонка grid, прижата к краю, не сжимается */}
          <div className="flex shrink-0 items-center gap-2 justify-self-end">
            <button
              onClick={() => {
                haptic.impact('light');
                toggleTheme();
              }}
              className={cn(
                'rounded-xl border border-dark-700/50 bg-dark-800/50 p-2 text-dark-400 transition-colors duration-200 hover:bg-dark-700 hover:text-accent-400',
                !canToggleTheme && 'hidden',
              )}
              aria-label={
                isDark ? t('theme.light') || 'Light mode' : t('theme.dark') || 'Dark mode'
              }
              title={isDark ? t('theme.light') || 'Light mode' : t('theme.dark') || 'Dark mode'}
            >
              {isDark ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
            </button>
            <TicketNotificationBell isAdmin={location.pathname.startsWith('/admin')} />
            <LanguageSwitcher />
            <button
              onClick={() => {
                haptic.impact('light');
                logout();
              }}
              className="rounded-xl border border-dark-700/50 bg-dark-800/50 p-2 text-dark-400 transition-colors duration-200 hover:bg-dark-700 hover:text-accent-400"
              title={t('nav.logout')}
            >
              <LogoutIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <AppHeader
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onCommandPaletteOpen={() => {}}
        headerHeight={headerHeight}
        isFullscreen={isMobileFullscreen}
        safeAreaInset={safeAreaInset}
        contentSafeAreaInset={contentSafeAreaInset}
        telegramPlatform={platform}
        wheelEnabled={wheelEnabled}
        referralEnabled={referralEnabled}
        hasContests={hasContests}
        hasPolls={hasPolls}
        giftEnabled={giftEnabled}
      />

      {/* Desktop spacer */}
      <div className="hidden h-14 lg:block" />

      {/* Mobile spacer */}
      <div className="lg:hidden" style={{ height: headerHeight }} />

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 lg:px-6 lg:pb-8">{children}</main>

      {/* Footer */}
      <FooterLinks />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        isKeyboardOpen={isKeyboardOpen}
        referralEnabled={referralEnabled}
        wheelEnabled={wheelEnabled}
      />
    </div>
  );
}

// ============================================================
// Footer with legal document modals
// ============================================================

const PRIVACY_POLICY = `Политика конфиденциальности

h0pp — 21 августа 2026

Настоящая Политика конфиденциальности регулирует порядок сбора, использования и защиты информации пользователей сервиса h0pp, доступного на сайте codehubcentral.com и в Telegram-боте @h0pp_bot (далее — «Сервис»). Сервис может собирать идентификаторы аккаунта, техническую информацию и историю взаимодействий. Полученные данные используются исключительно для обеспечения работы сервиса, связи с пользователями и анализа работы системы.

Передача информации третьим лицам возможна только в случаях, предусмотренных законодательством, либо с согласия пользователя. Данные хранятся в течение срока, необходимого для работы сервиса, и защищаются разумными мерами безопасности. Пользователь самостоятельно несёт ответственность за риски, связанные с передачей данных через интернет.

Администрация вправе вносить изменения в настоящую Политику без предварительного уведомления. Продолжение использования сервиса означает согласие пользователя с актуальной редакцией Политики.

1. Общие положения

1.1. Настоящая Политика конфиденциальности (далее — «Политика») регулирует порядок обработки и защиты информации, которую Пользователь передаёт при использовании сервиса (далее — «Сервис»).

1.2. Используя Сервис, Пользователь подтверждает своё согласие с условиями настоящей Политики. Если Пользователь не согласен с условиями Политики, он обязан прекратить использование Сервиса.

2. Сбор информации

2.1. Сервис может собирать следующие типы данных:
— идентификаторы аккаунта (логин, ID, никнейм и т.п.);
— техническую информацию (IP-адрес, данные о браузере, устройстве и операционной системе);
— историю взаимодействий с Сервисом.

2.2. Сервис не требует от Пользователя предоставления паспортных данных, документов, фотографий или другой личной информации, кроме минимально необходимой для работы сервиса.

3. Использование информации

3.1. Полученная информация используется исключительно для:
— обеспечения работы функционала сервиса;
— связи с Пользователем (уведомления, поддержка);
— анализа и улучшения работы сервиса.

4. Передача информации третьим лицам

4.1. Администрация не передаёт данные третьим лицам, за исключением следующих случаев:
— если передача требуется в соответствии с законодательством;
— если передача необходима для исполнения обязательств перед Пользователем;
— если Пользователь дал явное согласие на передачу данных.

5. Хранение и защита данных

5.1. Данные хранятся в течение срока, необходимого для достижения целей их обработки.
5.2. Администрация принимает разумные меры для защиты данных, однако не может гарантировать абсолютную безопасность информации, передаваемой через интернет.

6. Ограничение ответственности

6.1. Пользователь понимает и принимает, что передача информации через интернет всегда связана с определёнными рисками.
6.2. Администрация не несёт ответственности за утрату, кражу или раскрытие данных, если это произошло по вине третьих лиц либо вследствие действий самого Пользователя.

7. Изменения в Политике

7.1. Администрация вправе изменять условия настоящей Политики без предварительного уведомления пользователей.
7.2. Продолжение использования Сервиса после внесения изменений означает согласие Пользователя с новой редакцией Политики конфиденциальности.`;

const TERMS_OF_SERVICE = `Пользовательское соглашение

h0pp — 21 августа 2026

1. Общие положения

1.1. Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует порядок использования онлайн-сервиса h0pp, доступного на сайте codehubcentral.com и в Telegram-боте @h0pp_bot (далее — «Сервис»), предоставляемого Администрацией.

1.2. Используя Сервис, включая запуск бота, регистрацию, оплату услуг или получение доступа к материалам, Пользователь подтверждает, что полностью ознакомился с условиями настоящего Соглашения и принимает их в полном объёме.

1.3. В случае несогласия с условиями настоящего Соглашения Пользователь обязан прекратить использование Сервиса.

2. Характер услуг и цифровых товаров

2.1. Сервис предоставляет цифровые товары и услуги нематериального характера, включая, но не ограничиваясь: информационные материалы, обучающие программы, консультации, цифровые продукты и сервисные услуги.

2.2. Пользователь соглашается, что ценность цифровых товаров и услуг Сервиса заключается в систематизации информации, анализе, форме подачи, сопровождении, поддержке и обновлениях.

2.3. Сервис не гарантирует уникальность или исключительность отдельных элементов предоставляемых материалов.

3. Отказ от гарантий и ответственности

3.1. Сервис предоставляется на условиях «AS IS» («как есть»).

3.2. Администрация не гарантирует:
— соответствие Сервиса ожиданиям Пользователя;
— достижение каких-либо финансовых, коммерческих или профессиональных результатов;
— бесперебойную и безошибочную работу Сервиса.

3.3. Все решения о применении материалов, рекомендаций и услуг принимаются Пользователем самостоятельно и на свой риск.

4. Законность использования

4.1. Сервис не предназначен для поощрения, организации или содействия противоправной деятельности.
4.2. Пользователь обязуется использовать Сервис исключительно в рамках действующего законодательства.
4.3. Ответственность за законность использования материалов и услуг Сервиса полностью возлагается на Пользователя.

5. Интеллектуальная собственность

5.1. Все материалы, размещённые в Сервисе, защищены законодательством об интеллектуальной собственности.
5.2. Пользователю запрещается копировать, распространять, перепродавать или иным образом использовать материалы Сервиса без разрешения правообладателя.

6. Ограничение доступа

6.1. Администрация вправе приостановить или ограничить доступ Пользователя к Сервису в случае нарушения условий настоящего Соглашения.
6.2. Ограничение доступа не освобождает Пользователя от ранее возникших обязательств.

7. Платежи и возвраты

7.1. Оплата услуг и цифровых товаров осуществляется на условиях, указанных в Сервисе до момента оплаты.
7.2. В связи с нематериальным характером цифровых товаров возврат денежных средств после предоставления доступа не осуществляется, за исключением случаев технической вины Сервиса.
7.3. Для рассмотрения запроса о возврате Пользователь должен обратиться в службу поддержки в течение 24 часов с момента оплаты.
7.4. Пользователь обязуется не инициировать возврат платежа (chargeback) без предварительного обращения в службу поддержки.

8. Изменение условий

8.1. Администрация вправе изменять условия настоящего Соглашения.
8.2. Продолжение использования Сервиса означает согласие Пользователя с обновлёнными условиями.

9. Контактная информация

9.1. По всем вопросам Пользователь может обратиться в службу поддержки через форму обратной связи в боте.

Используя Сервис (в том числе запуская бота и/или вводя команду /start), Пользователь подтверждает, что ознакомлен с настоящим Соглашением и принимает его условия в полном объёме.`;

function LegalModal({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl border border-dark-700/50 bg-dark-900 sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dark-700/50 px-6 py-4">
          <h2 className="text-base font-semibold text-dark-100">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-400 transition-colors hover:bg-dark-800 hover:text-dark-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Content */}
        <div className="overflow-y-auto px-6 py-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-dark-300">{content}</pre>
        </div>
      </div>
    </div>
  );
}

function FooterLinks() {
  const [modal, setModal] = useState<'privacy' | 'terms' | null>(null);

  return (
    <>
      <footer className="pb-24 pt-6 text-center lg:pb-8">
        <div className="flex items-center justify-center gap-4 text-xs text-dark-500">
          <button
            onClick={() => setModal('terms')}
            className="transition-colors hover:text-dark-300"
          >
            Пользовательское соглашение
          </button>
          <span>·</span>
          <button
            onClick={() => setModal('privacy')}
            className="transition-colors hover:text-dark-300"
          >
            Политика конфиденциальности
          </button>
          <span>·</span>
          <span>money</span>
        </div>
      </footer>

      {modal === 'privacy' && (
        <LegalModal
          title="Политика конфиденциальности"
          content={PRIVACY_POLICY}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'terms' && (
        <LegalModal
          title="Пользовательское соглашение"
          content={TERMS_OF_SERVICE}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
