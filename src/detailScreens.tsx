import { useRef, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { images } from './data';
import { colors, fonts, radius } from './theme';
import { Button, Chip, CuritText, Field, Header, Icon } from './ui';

export type ProjectProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  mode: '전시·판매' | '전시만';
  type: 'goods' | 'artwork';
};

type ProductDraft = Pick<ProjectProduct, 'name' | 'image' | 'mode' | 'type'> & { price: string; stock: string };

export const initialCreatorProducts: ProjectProduct[] = [
  { id: 'mug-black', name: '검정 머그', price: 15000, stock: 6, image: '', mode: '전시·판매', type: 'goods' },
];

const ordinal = (index: number) => ['첫 번째', '두 번째', '세 번째', '네 번째'][index] ?? `${index + 1}번째`;

export function CreatorProjectScreen({ products, onBack, onEdit }: { products: ProjectProduct[]; onBack: () => void; onEdit: () => void }) {
  return (
    <View style={d.flex}>
      <Header title="내 전시 프로젝트" back={onBack} />
      <ScrollView contentContainerStyle={d.detailScroll} showsVerticalScrollIndicator={false}>
        <CuritText weight="medium" style={d.status}>매칭 모집 중</CuritText>
        <CuritText weight="bold" style={d.projectTitle}>최종 프로젝트</CuritText>
        <CuritText style={d.description}>등록한 프로젝트 콘셉트</CuritText>
        <CuritText style={d.meta}>서울</CuritText>
        <CuritText style={d.status}>협업 목적 · 작품 판매</CuritText>

        <View style={d.productHeading}>
          <CuritText weight="bold" style={d.sectionTitle}>상품 {products.length}개</CuritText>
          <CuritText style={d.hint}>상품을 눌러 상세 확인</CuritText>
        </View>
        <View style={d.productStack}>
          {products.map((item, index) => (
            <View key={item.id} style={d.detailProductCard}>
              {item.image ? <Image source={{ uri: item.image }} style={d.detailThumb} contentFit="cover" /> : <View style={d.ordinalBox}><CuritText weight="bold" style={d.ordinalText}>{String(index + 1).padStart(2, '0')}</CuritText></View>}
              <View style={d.flex}>
                <CuritText weight="semibold" style={d.productName}>{item.name}</CuritText>
                <CuritText style={d.productMeta}>{item.mode === '전시만' ? '전시 전용' : `${item.price.toLocaleString()}원`} · 재고 {item.stock}개</CuritText>
                <CuritText style={d.pickup}>{item.type === 'goods' ? '결제 후 현장 수령' : '구매 예약 · 전시 종료 후 수령'}</CuritText>
              </View>
              <CuritText weight="bold" style={d.plus}>＋</CuritText>
            </View>
          ))}
        </View>
        <View style={d.conditionCard}><CuritText weight="bold">판매 · 위탁 조건</CuritText><View style={d.row}><CuritText style={d.muted}>작가 배분 80%</CuritText><Icon name="chevron" size={16} color={colors.brand} /></View></View>
        <View style={d.publishRow}><CuritText>프로젝트 공개</CuritText><CuritText weight="semibold" style={d.status}>공개 중 →</CuritText></View>
      </ScrollView>
      <View style={d.stickyFooter}><Button label="프로젝트 수정" onPress={onEdit} /></View>
    </View>
  );
}

export function CreatorProjectEditScreen({ products, onChange, onBack }: { products: ProjectProduct[]; onChange: (items: ProjectProduct[]) => void; onBack: () => void }) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>({ name: '', price: '', stock: '', image: '', mode: '전시·판매', type: 'goods' });
  const [notice, setNotice] = useState('');

  const reset = () => {
    setDraft({ name: '', price: '', stock: '', image: '', mode: '전시·판매', type: 'goods' });
    setNotice('');
    setFormOpen(false);
    Keyboard.dismiss();
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
    });
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.82 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset?.uri) return;
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      setNotice('5MB 이하의 JPG, PNG 또는 WEBP 이미지를 선택해 주세요.');
      return;
    }
    setNotice('');
    setDraft(previous => ({ ...previous, image: asset.uri }));
  };

  const saveProduct = () => {
    const price = Number(draft.price);
    const stock = Number(draft.stock);
    if (!draft.name.trim() || !Number.isInteger(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
      setNotice('상품명·판매가·정수 재고를 확인해 주세요.');
      return;
    }
    onChange([...products, { id: `product-${Date.now()}`, name: draft.name.trim(), price, stock, image: draft.image, mode: draft.mode, type: draft.type }]);
    reset();
  };

  return (
    <KeyboardAvoidingView style={d.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="전시 프로젝트 수정" subtitle="내 전시 프로젝트" back={onBack} />
      <ScrollView ref={scrollRef} style={d.flex} contentContainerStyle={d.editScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View>
          <CuritText style={d.status}>내 전시 프로젝트</CuritText>
          <CuritText weight="bold" style={d.projectTitle}>최종 프로젝트</CuritText>
          <CuritText style={d.description}>프로젝트 정보와 상품을 수정할 수 있어요. * 필수</CuritText>
        </View>

        <View style={d.productHeading}><CuritText weight="bold" style={d.sectionTitle}>작품 · 굿즈 {products.length}개 *</CuritText></View>
        <View style={d.productStack}>
          {products.map((item, index) => (
            <View key={item.id} style={d.editProductCard}>
              {item.image ? <Image source={{ uri: item.image }} style={d.editThumb} contentFit="cover" /> : <View style={d.smallOrdinal}><CuritText weight="bold" style={d.ordinalText}>{String(index + 1).padStart(2, '0')}</CuritText></View>}
              <View style={d.flex}><CuritText style={d.ordinalLabel}>{ordinal(index)} 상품</CuritText><CuritText weight="semibold">{item.name}</CuritText><CuritText style={d.productMeta}>{item.price.toLocaleString()}원 · 재고 {item.stock}개</CuritText></View>
              <Pressable style={d.miniButton}><CuritText weight="semibold" style={d.status}>수정</CuritText></Pressable>
            </View>
          ))}
        </View>

        {!formOpen ? (
          <Pressable style={d.addProductButton} onPress={() => setFormOpen(true)}>
            <CuritText weight="semibold" style={d.status}>＋ {ordinal(products.length)} 상품 추가하기</CuritText>
          </Pressable>
        ) : (
          <View style={d.productForm}>
            <View style={d.formHeader}><CuritText weight="bold" style={d.formTitle}>{ordinal(products.length)} 상품 추가</CuritText><Pressable hitSlop={12} onPress={reset}><CuritText style={d.close}>×</CuritText></Pressable></View>
            <Pressable style={d.photoPicker} onPress={() => { void pickImage(); }}>
              <View style={d.photoSlot}>
                {draft.image ? <Image source={{ uri: draft.image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="discover" color={colors.brand} />}
              </View>
              <View style={d.flex}><CuritText weight="semibold">{draft.image ? '상품 사진 변경' : '상품 사진 추가 · 선택'}</CuritText><CuritText style={d.hint}>JPG · PNG · WEBP / 5MB 이하</CuritText></View>
              <Icon name="chevron" size={17} color={colors.brand} />
            </Pressable>
            {draft.image ? <Pressable onPress={() => setDraft(previous => ({ ...previous, image: '' }))}><CuritText style={d.removePhoto}>사진 삭제</CuritText></Pressable> : null}

            <Field label="상품명 *" value={draft.name} onChangeText={name => setDraft(previous => ({ ...previous, name }))} placeholder="예: 검정 머그" />
            <View style={d.formField}><CuritText weight="semibold" style={d.label}>판매 방식 *</CuritText><View style={d.modeRow}>{(['전시·판매', '전시만'] as const).map(mode => <Chip key={mode} label={mode} active={draft.mode === mode} onPress={() => setDraft(previous => ({ ...previous, mode }))} />)}</View></View>
            <View style={d.twoColumns}><View style={d.flex}><Field label="판매가 (원) *" value={draft.price} onChangeText={price => setDraft(previous => ({ ...previous, price: price.replace(/\D/g, '') }))} keyboardType="number-pad" placeholder="15000" /></View><View style={d.flex}><Field label="재고 *" value={draft.stock} onChangeText={stock => setDraft(previous => ({ ...previous, stock: stock.replace(/\D/g, '') }))} keyboardType="number-pad" placeholder="6" /></View></View>
            <View style={d.formField}><CuritText weight="semibold" style={d.label}>상품 유형 *</CuritText><View style={d.twoColumns}><ProductType active={draft.type === 'goods'} title="소형 굿즈" caption="결제 후 현장 수령" onPress={() => setDraft(previous => ({ ...previous, type: 'goods' }))} /><ProductType active={draft.type === 'artwork'} title="원화 · 전시 작품" caption="전시 종료 후 전달" onPress={() => setDraft(previous => ({ ...previous, type: 'artwork' }))} /></View></View>
            {notice ? <CuritText style={d.error}>{notice}</CuritText> : null}
            <Button label="상품 저장" onPress={saveProduct} />
          </View>
        )}
        <View style={d.editNotice}><CuritText style={d.hint}>이미 확정된 협업의 가격·공급 조건은 바뀌지 않으며, 변경 내용은 이후 제안부터 적용됩니다.</CuritText></View>
        {!formOpen ? <Button label="수정 완료" onPress={onBack} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProductType({ active, title, caption, onPress }: { active: boolean; title: string; caption: string; onPress: () => void }) {
  return <Pressable style={[d.typeCard, active && d.typeCardActive]} onPress={onPress}><CuritText weight="semibold" style={active ? d.status : undefined}>{title}</CuritText><CuritText style={d.hint}>{caption}</CuritText></Pressable>;
}

export function StoreSignupScreen({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const [introOpen, setIntroOpen] = useState(true);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [intro, setIntro] = useState('');
  const [audience, setAudience] = useState('');
  const valid = name.trim() && address.trim() && intro.trim() && audience.trim();
  return (
    <KeyboardAvoidingView style={d.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="매장 공간 등록" subtitle="기본 정보" back={onBack} />
      <ScrollView style={d.flex} contentContainerStyle={d.signupScroll} keyboardShouldPersistTaps="handled">
        <StepProgress />
        <CuritText weight="bold" style={d.projectTitle}>매장을 소개해 주세요</CuritText>
        <CuritText style={d.description}>기본 정보를 입력하면 맞는 크리에이터를 찾아드려요.</CuritText>
        <Field label="매장명 *" value={name} onChangeText={setName} placeholder="예: 최종 매장" />
        <Field label="업종 · 선택" value={category} onChangeText={setCategory} placeholder="예: 카페" />
        <Field label="상세 주소 *" value={address} onChangeText={setAddress} placeholder="예: 서울 마포구 검증로 1" />
        <RequiredAccordion title="매장 소개" open={introOpen} complete={!!intro.trim()} onPress={() => setIntroOpen(value => !value)}>
          <CuritText weight="semibold" style={d.smallLabel}>크리에이터에게 보여줄 소개</CuritText>
          <TextInput multiline value={intro} onChangeText={setIntro} placeholder="매장의 분위기와 함께하고 싶은 작품을 알려주세요." placeholderTextColor="#B7B7B7" style={d.textarea} />
        </RequiredAccordion>
        <RequiredAccordion title="주 고객층" open={audienceOpen} complete={!!audience.trim()} onPress={() => setAudienceOpen(value => !value)}>
          <CuritText weight="semibold" style={d.smallLabel}>주로 방문하는 손님</CuritText>
          <TextInput value={audience} onChangeText={setAudience} placeholder="예: 20–30대 직장인, 예술 관심층" placeholderTextColor="#B7B7B7" style={d.textInput} />
        </RequiredAccordion>
      </ScrollView>
      <View style={d.stickyFooter}><Button label="다음: 취향 등록" disabled={!valid} onPress={onComplete} /></View>
    </KeyboardAvoidingView>
  );
}

function RequiredAccordion({ title, open, complete, onPress, children }: { title: string; open: boolean; complete: boolean; onPress: () => void; children: ReactNode }) {
  return <View style={d.accordion}><Pressable style={d.accordionHeader} onPress={onPress}><View style={d.requiredTitle}><CuritText weight="bold">{title}</CuritText><CuritText weight="bold" style={d.requiredStar}>*</CuritText></View><View style={d.accordionRight}><CuritText style={d.hint}>{complete ? '작성 완료' : '필수'}</CuritText><View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}><Icon name="chevron" size={16} color={colors.brand} /></View></View></Pressable>{open ? <View style={d.accordionBody}>{children}</View> : null}</View>;
}

function StepProgress() {
  return <View style={d.steps}>{['1 정보', '2 취향', '3 사진', '4 구역', '5 확인'].map((label, index) => <View key={label} style={d.step}><View style={[d.stepLine, index === 0 && d.stepLineActive]} /><CuritText weight={index === 0 ? 'semibold' : 'regular'} style={[d.stepLabel, index === 0 && d.status]}>{label}</CuritText></View>)}</View>;
}

const d = StyleSheet.create({
  flex: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', gap: 4 }, muted: { color: colors.muted }, status: { color: colors.brand },
  detailScroll: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 24 }, editScroll: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28, gap: 22 }, signupScroll: { padding: 20, paddingBottom: 28, gap: 20 },
  projectTitle: { fontSize: 24, lineHeight: 31, marginTop: 8 }, description: { color: colors.muted, marginTop: 12 }, meta: { color: colors.muted, fontSize: 12, marginTop: 14 },
  productHeading: { marginTop: 28, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { fontSize: 17 }, hint: { color: colors.muted, fontSize: 11, lineHeight: 17 }, productStack: { gap: 12 },
  detailProductCard: { minHeight: 96, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: '#F8F8F8', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ordinalBox: { width: 44, height: 58, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, smallOrdinal: { width: 46, height: 46, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, ordinalText: { color: colors.brand, fontSize: 17 }, detailThumb: { width: 58, height: 58, borderRadius: 12 }, editThumb: { width: 48, height: 48, borderRadius: 10 }, productName: { fontSize: 15 }, productMeta: { color: colors.muted, fontSize: 11, marginTop: 5 }, pickup: { color: colors.brand, fontSize: 10, marginTop: 5 }, plus: { color: colors.brand, fontSize: 18 },
  conditionCard: { minHeight: 78, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }, publishRow: { minHeight: 56, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  stickyFooter: { flexShrink: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, backgroundColor: colors.surface },
  editProductCard: { minHeight: 76, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: '#F8F8F8', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, ordinalLabel: { color: colors.muted, fontSize: 10, marginBottom: 3 }, miniButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, backgroundColor: colors.surface },
  addProductButton: { minHeight: 64, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C8D3BF', backgroundColor: '#FAFBF8', alignItems: 'center', justifyContent: 'center' },
  productForm: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, gap: 16, backgroundColor: colors.surface }, formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, formTitle: { fontSize: 16 }, close: { fontSize: 26, lineHeight: 28 },
  photoPicker: { minHeight: 96, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C8D3BF', borderRadius: radius.md, backgroundColor: colors.brandPale, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' }, photoSlot: { width: 66, height: 66, flexShrink: 0, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, removePhoto: { color: colors.danger, fontSize: 12 },
  formField: { gap: 9 }, label: { fontSize: 13 }, modeRow: { flexDirection: 'row', gap: 8 }, twoColumns: { flexDirection: 'row', gap: 12 }, typeCard: { flex: 1, minHeight: 80, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, gap: 8, justifyContent: 'center' }, typeCardActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft }, error: { color: colors.danger, fontSize: 12 }, editNotice: { padding: 14, backgroundColor: '#F8F8F8', borderRadius: radius.md },
  steps: { flexDirection: 'row', gap: 8 }, step: { flex: 1, gap: 7 }, stepLine: { height: 4, borderRadius: 2, backgroundColor: colors.border }, stepLineActive: { backgroundColor: colors.brand }, stepLabel: { color: colors.muted, fontSize: 10 },
  accordion: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' }, accordionHeader: { minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, requiredTitle: { flexDirection: 'row', alignItems: 'center', gap: 3 }, requiredStar: { color: colors.danger }, accordionRight: { flexDirection: 'row', alignItems: 'center', gap: 9 }, accordionBody: { paddingHorizontal: 12, paddingBottom: 14, gap: 9 }, smallLabel: { fontSize: 12 }, textarea: { minHeight: 104, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 13, fontFamily: fonts.regular, fontSize: 14, color: colors.ink, textAlignVertical: 'top' }, textInput: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 13, fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
});
