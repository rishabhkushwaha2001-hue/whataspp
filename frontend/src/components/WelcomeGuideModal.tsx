import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, borderRadius, shadows } from '../theme/theme';

const { width, height } = Dimensions.get('window');

export interface WelcomeGuideModalProps {
  visible: boolean;
  onClose: () => void;
}

type PreviewType = 'dashboard' | 'members' | 'whatsapp' | 'retention' | 'onboarding';

interface SlideItem {
  stepNum: number;
  icon: string;
  badge: string;
  title: string;
  subtitle: string;
  color: string;
  previewType: PreviewType;
  features: {
    icon: string;
    title: string;
    desc: string;
  }[];
}

const SLIDES: SlideItem[] = [
  {
    stepNum: 1,
    icon: 'trophy',
    badge: 'STEP 1 OF 5 • OVERVIEW',
    title: 'Welcome to Smart Gym HQ',
    subtitle: 'Say goodbye to physical registers! Manage your entire gym facility, members, revenue, and attendance in one modern app.',
    color: '#8B5CF6',
    previewType: 'dashboard',
    features: [
      {
        icon: 'line-chart',
        title: 'Real-Time Revenue Dashboard',
        desc: 'Track daily cash/UPI collections, active member counts, and attendance trends at a glance.',
      },
      {
        icon: 'bolt',
        title: 'One-Tap Quick Actions',
        desc: 'Add new members, log fee payments, or inspect expiring memberships instantly.',
      },
    ],
  },
  {
    stepNum: 2,
    icon: 'users',
    badge: 'STEP 2 OF 5 • MEMBER MANAGEMENT',
    title: 'All Member Profiles in Your Pocket',
    subtitle: 'Search, filter, and inspect students with automatic status tags and membership history.',
    color: '#10B981',
    previewType: 'members',
    features: [
      {
        icon: 'filter',
        title: 'Smart Status Filters',
        desc: 'Instantly isolate Active, Due Soon (next 7 days), Expired, or Trial members.',
      },
      {
        icon: 'phone',
        title: 'Direct Call & Profile Summary',
        desc: 'One tap to call or check fee records without searching your phone book.',
      },
    ],
  },
  {
    stepNum: 3,
    icon: 'whatsapp',
    badge: 'STEP 3 OF 5 • AUTOMATED OUTREACH',
    title: '1-Click WhatsApp Fee Reminders',
    subtitle: 'Collect pending dues politely and automatically without making awkward reminder calls.',
    color: '#25D366',
    previewType: 'whatsapp',
    features: [
      {
        icon: 'send',
        title: 'Pre-Filled WhatsApp Templates',
        desc: 'Open WhatsApp directly with customized payment reminders and birthday wishes.',
      },
      {
        icon: 'gift',
        title: 'Attach Discount Offers',
        desc: 'Automatically append your active promotional offers to renewal messages.',
      },
    ],
  },
  {
    stepNum: 4,
    icon: 'heartbeat',
    badge: 'STEP 4 OF 5 • CHURN INTELLIGENCE',
    title: 'Retention & Churn Analytics',
    subtitle: 'Stop losing members to silent churn with pro diagnostic reports and early warning alerts.',
    color: '#F59E0B',
    previewType: 'retention',
    features: [
      {
        icon: 'user-times',
        title: 'Ghost Members (Absent 30+ Days)',
        desc: 'Spot active members who stopped visiting and re-engage them before they drop out.',
      },
      {
        icon: 'calendar-check-o',
        title: 'Urgent Expiry Pipeline',
        desc: 'Track memberships expiring within 7 days to secure renewals early.',
      },
    ],
  },
  {
    stepNum: 5,
    icon: 'magic',
    badge: 'STEP 5 OF 5 • NEXT LEVEL',
    title: 'You Are Ready to Lead!',
    subtitle: 'Your gym is now powered by state-of-the-art CRM automation. Grow your revenue on autopilot.',
    color: '#EC4899',
    previewType: 'onboarding',
    features: [
      {
        icon: 'refresh',
        title: 'Self-Onboarding Ready',
        desc: 'Students can try free trials and renew online with instant DB extension.',
      },
      {
        icon: 'question-circle',
        title: 'Help Guide Always Available',
        desc: 'Tap the "?" Guide button on your dashboard anytime to review this manual.',
      },
    ],
  },
];

export const WelcomeGuideModal: React.FC<WelcomeGuideModalProps> = ({ visible, onClose }) => {
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const [currentStep, setCurrentStep] = useState(0);

  if (!visible) return null;

  const slide = SLIDES[currentStep];

  const handleNext = () => {
    if (currentStep < SLIDES.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setCurrentStep(0);
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    setCurrentStep(0);
    onClose();
  };

  // ── Render Mini App Screen Preview Mockup ──────────────────────────────────
  const renderScreenPreview = (previewType: PreviewType, color: string) => {
    return (
      <View style={[styles.mockupContainer, { backgroundColor: isDark ? '#141824' : '#F1F5F9', borderColor: color + '40' }]}>
        {/* Top Mini App Bar */}
        <View style={styles.mockupHeader}>
          <View style={styles.mockupDotsRow}>
            <View style={[styles.mockupDot, { backgroundColor: '#EF4444' }]} />
            <View style={[styles.mockupDot, { backgroundColor: '#F59E0B' }]} />
            <View style={[styles.mockupDot, { backgroundColor: '#10B981' }]} />
          </View>
          <Text style={[styles.mockupHeaderText, { color: colors.textMuted }]}>
            {previewType === 'dashboard' && '📱 FitZone Gym • Live Dashboard'}
            {previewType === 'members' && '📱 Members • Smart Filter'}
            {previewType === 'whatsapp' && '📱 WhatsApp Auto-Reminder'}
            {previewType === 'retention' && '📱 Churn & Ghost Member Report'}
            {previewType === 'onboarding' && '📱 Student App • Self Onboarding'}
          </Text>
        </View>

        {/* 1. Dashboard Preview */}
        {previewType === 'dashboard' && (
          <View style={styles.previewBody}>
            <View style={[styles.previewCard, { backgroundColor: isDark ? '#1E2434' : '#FFF', borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>TODAY'S COLLECTION</Text>
                <View style={{ backgroundColor: '#10B98120', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                  <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '800' }}>▲ +24%</Text>
                </View>
              </View>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 4 }}>₹ 18,500</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={[styles.miniChip, { backgroundColor: '#10B98115', borderColor: '#10B98140' }]}>
                <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '800' }}>🟢 142 Active</Text>
              </View>
              <View style={[styles.miniChip, { backgroundColor: '#EF444415', borderColor: '#EF444440' }]}>
                <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '800' }}>🔴 12 Expired</Text>
              </View>
              <View style={[styles.miniChip, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B40' }]}>
                <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '800' }}>🟡 8 Due</Text>
              </View>
            </View>
          </View>
        )}

        {/* 2. Members Preview */}
        {previewType === 'members' && (
          <View style={styles.previewBody}>
            <View style={[styles.previewSearchBar, { backgroundColor: isDark ? '#1E2434' : '#FFF', borderColor: colors.border }]}>
              <FontAwesome name="search" size={11} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 11, marginLeft: 6 }}>Search member by name or phone...</Text>
            </View>
            <View style={[styles.previewMemberCard, { backgroundColor: isDark ? '#1E2434' : '#FFF', borderColor: colors.border }]}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#8B5CF620', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#8B5CF6', fontWeight: '800', fontSize: 12 }}>RS</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>Rohan Sharma</Text>
                <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 11 }}>🟢 Active • 42 Days Left</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <View style={[styles.miniActionBtn, { backgroundColor: '#8B5CF615' }]}>
                  <FontAwesome name="phone" size={12} color="#8B5CF6" />
                </View>
                <View style={[styles.miniActionBtn, { backgroundColor: '#25D36620' }]}>
                  <FontAwesome name="whatsapp" size={12} color="#25D366" />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 3. WhatsApp Preview */}
        {previewType === 'whatsapp' && (
          <View style={styles.previewBody}>
            <View style={[styles.previewChatBubble, { backgroundColor: '#25D36615', borderColor: '#25D36640' }]}>
              <Text style={{ color: colors.text, fontSize: 11, lineHeight: 16 }}>
                "Hi Rohan! Your gym membership at FitZone expires in <Text style={{ fontWeight: '800' }}>2 days (31 Jul)</Text>. Renew today & get 10% festive discount! 💪"
              </Text>
              <View style={{ backgroundColor: '#25D36625', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginTop: 6 }}>
                <Text style={{ color: '#16A34A', fontSize: 10, fontWeight: '800' }}>🎁 FESTIVE10 COUPON ATTACHED</Text>
              </View>
            </View>
            <View style={[styles.previewButton, { backgroundColor: '#25D366' }]}>
              <FontAwesome name="whatsapp" size={13} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800', marginLeft: 6 }}>Open WhatsApp Direct</Text>
            </View>
          </View>
        )}

        {/* 4. Retention Preview */}
        {previewType === 'retention' && (
          <View style={styles.previewBody}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '800' }}>🛡️ Retention Rate: 84%</Text>
              <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '800' }}>3 Ghost Members</Text>
            </View>
            <View style={[styles.previewGhostCard, { backgroundColor: '#EF444410', borderColor: '#EF444440' }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>🚨 Amit Kumar</Text>
                <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>Active • Absent for 34 Days!</Text>
              </View>
              <View style={[styles.previewMiniBtn, { backgroundColor: '#EF4444' }]}>
                <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>Re-engage 💬</Text>
              </View>
            </View>
          </View>
        )}

        {/* 5. Onboarding Preview */}
        {previewType === 'onboarding' && (
          <View style={styles.previewBody}>
            <View style={[styles.previewTrialBanner, { backgroundColor: '#8B5CF615', borderColor: '#8B5CF640' }]}>
              <Text style={{ color: '#8B5CF6', fontSize: 11, fontWeight: '800' }}>⏳ 3-Day Free Trial Mode • 2 Days Left</Text>
            </View>
            <View style={[styles.previewPlanCard, { backgroundColor: isDark ? '#1E2434' : '#FFF', borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>👑 Quarterly Pro Plan</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>✓ Unlimited Gym  ✓ Free Diet Chart</Text>
              </View>
              <Text style={{ color: '#10B981', fontSize: 14, fontWeight: '900' }}>₹ 4,500</Text>
            </View>
            <View style={[styles.previewButton, { backgroundColor: '#EC4899', marginTop: 6 }]}>
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>Pay Online (UPI / GPay / PhonePe)</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Top Bar: Step Counter & Skip */}
            <View style={styles.topBar}>
              <View style={[styles.badgeContainer, { backgroundColor: `${slide.color}18` }]}>
                <Text style={[styles.badgeText, { color: slide.color }]}>{slide.badge}</Text>
              </View>
              <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
                  Skip Guide ✕
                </Text>
              </TouchableOpacity>
            </View>

            {/* Slide Body */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{slide.subtitle}</Text>

              {/* ── LIVE SCREEN MOCKUP PREVIEW BOX ── */}
              {renderScreenPreview(slide.previewType, slide.color)}

              {/* Features List */}
              <View style={styles.featuresList}>
                {slide.features.map((feat, idx) => (
                  <View
                    key={`${feat.title}_${idx}`}
                    style={[
                      styles.featureCard,
                      { backgroundColor: isDark ? '#1F2430' : '#F8FAFC', borderColor: colors.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.featureIconBox,
                        { backgroundColor: `${slide.color}15` },
                      ]}
                    >
                      <FontAwesome name={feat.icon as any} size={16} color={slide.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.featureTitle, { color: colors.text }]}>{feat.title}</Text>
                      <Text style={[styles.featureDesc, { color: colors.textMuted }]}>{feat.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Bottom Footer: Dots & Buttons */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              {/* Slide Dots */}
              <View style={styles.dotsRow}>
                {SLIDES.map((s, i) => {
                  const isActive = i === currentStep;
                  return (
                    <View
                      key={`dot_${i}`}
                      style={[
                        styles.dot,
                        {
                          width: isActive ? 24 : 8,
                          backgroundColor: isActive ? slide.color : colors.border,
                        },
                      ]}
                    />
                  );
                })}
              </View>

              {/* Navigation Buttons */}
              <View style={styles.buttonsRow}>
                {currentStep > 0 ? (
                  <TouchableOpacity
                    onPress={handlePrev}
                    style={[styles.backButton, { borderColor: colors.border }]}
                  >
                    <FontAwesome name="arrow-left" size={14} color={colors.text} />
                    <Text style={[styles.backButtonText, { color: colors.text }]}>Back</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 80 }} />
                )}

                <TouchableOpacity activeOpacity={0.85} onPress={handleNext}>
                  <LinearGradient
                    colors={[slide.color, '#8B5CF6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.nextButton}
                  >
                    <Text style={styles.nextButtonText}>
                      {currentStep === SLIDES.length - 1 ? 'Enter Gym HQ 🚀' : 'Next Step ➔'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  card: {
    width: width > 500 ? 460 : '98%',
    maxHeight: height * 0.88,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.premium,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  badgeContainer: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  skipButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bodyContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  // ── MOCKUP STYLES ──
  mockupContainer: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 16,
    overflow: 'hidden',
  },
  mockupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.15)',
    gap: 10,
  },
  mockupDotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  mockupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mockupHeaderText: {
    fontSize: 11,
    fontWeight: '700',
  },
  previewBody: {
    padding: 12,
  },
  previewCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  miniChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  previewSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  previewMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  miniActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewChatBubble: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  previewButton: {
    flexDirection: 'row',
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewGhostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  previewMiniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  previewTrialBanner: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 8,
  },
  previewPlanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  // ── FEATURE CARDS ──
  featuresList: {
    width: '100%',
    gap: 10,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  featureIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  nextButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
