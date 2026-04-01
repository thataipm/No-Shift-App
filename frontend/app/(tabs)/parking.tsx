import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, ParkedIdea, Focus, getDaysInto, getDaysRemaining } from '../../lib/supabase';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';

export default function ParkingScreen() {
  const [ideas, setIdeas] = useState<ParkedIdea[]>([]);
  const [activeFocus, setActiveFocus] = useState<Focus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);

  // Promote friction
  const [promoteTarget, setPromoteTarget] = useState<ParkedIdea | null>(null);
  const [showPromoteFriction, setShowPromoteFriction] = useState(false);
  const [frictionStep, setFrictionStep] = useState<'initial' | 'reflection'>('initial');
  const [reflection, setReflection] = useState('');
  const [promoting, setPromoting] = useState(false);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: ideasData }, { data: focusData }] = await Promise.all([
      supabase.from('parked_ideas').select('*').eq('user_id', user.id).eq('status', 'parked').order('created_at', { ascending: false }),
      supabase.from('focuses').select('*').eq('user_id', user.id).eq('status', 'active').limit(1),
    ]);
    setIdeas(ideasData || []);
    setActiveFocus(focusData?.[0] || null);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from('parked_ideas').insert({ user_id: user.id, title: newTitle.trim() });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setNewTitle('');
    setShowAdd(false);
    await fetchData();
  };

  const handleDelete = (idea: ParkedIdea) => {
    Alert.alert('Delete idea?', `"${idea.title}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('parked_ideas').update({ status: 'deleted' }).eq('id', idea.id);
          await fetchData();
        },
      },
    ]);
  };

  const handlePromotePress = (idea: ParkedIdea) => {
    if (activeFocus) {
      setPromoteTarget(idea);
      setFrictionStep('initial');
      setShowPromoteFriction(true);
    } else {
      Alert.alert('Promote to Focus?', `Start working on "${idea.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote', onPress: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + 30);
            await supabase.from('focuses').insert({
              user_id: user.id, title: idea.title, deadline: deadline.toISOString().split('T')[0], status: 'active',
            });
            await supabase.from('parked_ideas').update({ status: 'promoted', promoted_at: new Date().toISOString() }).eq('id', idea.id);
            await fetchData();
          },
        },
      ]);
    }
  };

  const handlePromoteWithAbandon = async () => {
    if (!promoteTarget || !activeFocus) return;
    setPromoting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPromoting(false); return; }
    await supabase.from('focuses').update({ status: 'abandoned', reflection: reflection.trim() || null }).eq('id', activeFocus.id);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    await supabase.from('focuses').insert({
      user_id: user.id, title: promoteTarget.title, deadline: deadline.toISOString().split('T')[0], status: 'active',
    });
    await supabase.from('parked_ideas').update({ status: 'promoted', promoted_at: new Date().toISOString() }).eq('id', promoteTarget.id);
    setPromoting(false);
    setShowPromoteFriction(false);
    setPromoteTarget(null);
    setReflection('');
    await fetchData();
  };

  const renderIdea = ({ item }: { item: ParkedIdea }) => (
    <View style={styles.ideaCard} testID={`parked-idea-${item.id}`}>
      <View style={{ flex: 1 }}>
        <Text style={styles.ideaTitle}>{item.title}</Text>
        <Text style={styles.ideaDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
      <View style={styles.ideaActions}>
        <TouchableOpacity testID={`promote-idea-${item.id}`} style={styles.promoteBtn} onPress={() => handlePromotePress(item)}>
          <Text style={styles.promoteBtnText}>→ Focus</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`delete-idea-${item.id}`} style={styles.deleteBtn} onPress={() => handleDelete(item)}>
          <Text style={styles.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Parked Ideas</Text>
        <TouchableOpacity testID="add-idea-button" style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={ideas}
          keyExtractor={i => i.id}
          renderItem={renderIdea}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.empty} testID="parking-empty-state">
              <Text style={styles.emptyTitle}>No parked ideas</Text>
              <Text style={styles.emptyBody}>When a new idea tempts you, park it here instead of abandoning your focus.</Text>
            </View>
          }
        />
      )}

      {/* Add idea modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard} testID="add-idea-modal">
              <View style={styles.handle} />
              <Text style={styles.modalTitle}>Park a new idea</Text>
              <TextInput
                testID="add-idea-input"
                style={styles.input}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Your idea title…"
                placeholderTextColor={COLORS.textTertiary}
                autoFocus
                maxLength={100}
              />
              <TouchableOpacity testID="add-idea-save" style={[styles.primaryBtn, saving && styles.btnDisabled]} onPress={handleAdd} disabled={saving}>
                <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Park It'}</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="add-idea-cancel" style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Promote friction modal */}
      <Modal visible={showPromoteFriction} transparent animationType="fade" onRequestClose={() => setShowPromoteFriction(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.frictionOverlay}>
            <View style={styles.modalCard} testID="promote-friction-modal">
              <View style={styles.handle} />
              {frictionStep === 'initial' ? (
                <>
                  <Text style={styles.frictionWarn}>You're still committed.</Text>
                  <Text style={styles.modalSub}>Promoting <Text style={{ color: COLORS.primary }}>"{promoteTarget?.title}"</Text> will abandon your current focus.</Text>
                  <View style={styles.frictionBlock}>
                    <Text style={styles.frictionFocus}>{activeFocus?.title}</Text>
                    <Text style={styles.frictionFocusSub}>
                      {activeFocus ? `${getDaysInto(activeFocus.created_at)} days in · ${getDaysRemaining(activeFocus.deadline)} days left` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity testID="friction-confirm-promote" style={styles.dangerBtn} onPress={() => setFrictionStep('reflection')}>
                    <Text style={styles.dangerBtnText}>Abandon & Promote</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="friction-cancel-promote" style={styles.outlineBtn} onPress={() => setShowPromoteFriction(false)}>
                    <Text style={styles.outlineBtnText}>Keep My Focus</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle}>Quick reflection</Text>
                  <Text style={styles.modalSub}>What did you learn from "{activeFocus?.title}"? (Optional)</Text>
                  <TextInput
                    testID="promote-reflection-input"
                    style={styles.input}
                    value={reflection}
                    onChangeText={setReflection}
                    placeholder="What I learned…"
                    placeholderTextColor={COLORS.textTertiary}
                    multiline
                    autoFocus
                  />
                  <TouchableOpacity testID="promote-confirm-final" style={[styles.dangerBtn, promoting && styles.btnDisabled]} onPress={handlePromoteWithAbandon} disabled={promoting}>
                    <Text style={styles.dangerBtnText}>{promoting ? 'Saving…' : 'Confirm & Switch'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg },
  screenTitle: { fontFamily: FONTS.heading, fontSize: 28, color: COLORS.textPrimary },
  addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.primaryMuted, borderWidth: 1, borderColor: COLORS.borderActive },
  addBtnText: { fontFamily: FONTS.label, fontSize: 13, color: COLORS.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 40, gap: SPACING.sm },
  ideaCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderSubtle, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  ideaTitle: { fontFamily: FONTS.bodyMedium, fontSize: 16, color: COLORS.textPrimary },
  ideaDate: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textTertiary, marginTop: 3 },
  ideaActions: { flexDirection: 'row', gap: SPACING.sm },
  promoteBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, backgroundColor: COLORS.primaryMuted, borderWidth: 1, borderColor: COLORS.borderActive },
  promoteBtnText: { fontFamily: FONTS.label, fontSize: 12, color: COLORS.primary },
  deleteBtn: { width: 36, height: 36, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.textTertiary },
  empty: { paddingTop: 80, alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.xl },
  emptyTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.textPrimary, textAlign: 'center' },
  emptyBody: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  frictionOverlay: { flex: 1, backgroundColor: 'rgba(15,15,15,0.95)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: SPACING.lg, paddingBottom: 40, gap: SPACING.md },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderSubtle, alignSelf: 'center', marginBottom: SPACING.sm },
  modalTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.textPrimary },
  modalSub: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 },
  input: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, padding: SPACING.md, color: COLORS.textPrimary, fontFamily: FONTS.body, fontSize: 16, borderWidth: 1, borderColor: COLORS.borderSubtle, minHeight: 56 },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: '#000' },
  dangerBtn: { backgroundColor: COLORS.danger, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center' },
  dangerBtnText: { fontFamily: FONTS.bold, fontSize: 16, color: '#fff' },
  outlineBtn: { borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: RADIUS.pill, paddingVertical: 14, alignItems: 'center' },
  outlineBtnText: { fontFamily: FONTS.label, fontSize: 14, color: COLORS.textSecondary },
  cancelBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
  cancelBtnText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textTertiary },
  btnDisabled: { opacity: 0.5 },
  frictionWarn: { fontFamily: FONTS.heading, fontSize: 28, color: COLORS.primary },
  frictionBlock: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, padding: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.primary, gap: 4 },
  frictionFocus: { fontFamily: FONTS.headingMedium, fontSize: 17, color: COLORS.textPrimary },
  frictionFocusSub: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary },
});
