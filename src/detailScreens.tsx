import { useRef, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { friendlyError, mediaUrl, saveStoreOnboarding, uploadMedia, type CreatorProjectDetails, type StoreOnboarding } from './platform';
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
  imagePath?: string;
  description?: string;
  material?: string;
  widthMm?: number | null;
  heightMm?: number | null;
  pickupMode?: 'immediate' | 'exhibition';
  care?: string;
};

type ProductDraft = Pick<ProjectProduct, 'name' | 'image' | 'imagePath' | 'mode' | 'type'> & { price: string; stock: string; description: string; material: string; widthMm: string; heightMm: string; care: string };

export const initialCreatorProducts: ProjectProduct[] = [
  { id: 'mug-black', name: '검정 머그', price: 15000, stock: 6, image: '', mode: '전시·판매', type: 'goods' },
];

const ordinal = (index: number) => ['첫 번째', '두 번째', '세 번째', '네 번째'][index] ?? `${index + 1}번째`;

export function CreatorProjectScreen({ project, products, onBack, onEdit }: { project: CreatorProjectDetails; products: ProjectProduct[]; onBack: () => void; onEdit: () => void }) {
  return (
    <View style={d.flex}>
      <Header title="내 전시 프로젝트" back={onBack} />
      <ScrollView contentContainerStyle={d.detailScroll} showsVerticalScrollIndicator={false}>
        {project.coverUrl ? <Image source={{ uri: project.coverUrl }} style={d.projectCover} contentFit="cover" /> : null}
        <CuritText weight="medium" style={d.status}>{project.status === 'recruiting' ? '매칭 모집 중' : project.status === 'matched' ? '매칭 완료' : project.status === 'archived' ? '비공개' : '작성 중'}</CuritText>
        <CuritText weight="bold" style={d.projectTitle}>{project.title || '제목 없는 프로젝트'}</CuritText>
        <CuritText style={d.description}>{project.concept || project.story || '프로젝트 이야기를 등록해 주세요.'}</CuritText>
        <CuritText style={d.meta}>{project.region || '지역 협의'}</CuritText>
        <CuritText style={d.status}>협업 목적 · {project.purpose || '작품 전시 및 판매'}</CuritText>

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
        <View style={d.conditionCard}><CuritText weight="bold">판매 · 위탁 조건</CuritText><View style={d.row}><CuritText style={d.muted}>작가 배분 {project.creatorSharePercent}%</CuritText><Icon name="chevron" size={16} color={colors.brand} /></View></View>
        <View style={d.publishRow}><CuritText>프로젝트 공개</CuritText><CuritText weight="semibold" style={d.status}>{project.status === 'draft' || project.status === 'archived' ? '비공개' : '공개 중'} →</CuritText></View>
      </ScrollView>
      <View style={d.stickyFooter}><Button label="프로젝트 수정" onPress={onEdit} /></View>
    </View>
  );
}

export function CreatorProjectEditScreen({ project, products, onSaveProject, onSaveProduct, onUpdateProduct, onDeleteProduct, onBack }: { project: CreatorProjectDetails; products: ProjectProduct[]; onSaveProject: (value: Omit<CreatorProjectDetails, 'id' | 'coverUrl'> & { coverUri?: string }) => Promise<void>; onSaveProduct: (item: Omit<ProjectProduct, 'id'>) => Promise<void>; onUpdateProduct: (id: string, item: Omit<ProjectProduct, 'id'>) => Promise<void>; onDeleteProduct: (id: string) => Promise<void>; onBack: () => void }) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formOpen, setFormOpen] = useState(false);
  const emptyDraft: ProductDraft = { name: '', price: '', stock: '', image: '', imagePath: undefined, mode: '전시·판매', type: 'goods', description: '', material: '', widthMm: '', heightMm: '', care: '' };
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [editingId, setEditingId] = useState('');
  const [title, setTitle] = useState(project.title);
  const [story, setStory] = useState(project.story);
  const [concept, setConcept] = useState(project.concept);
  const [region, setRegion] = useState(project.region);
  const [purpose, setPurpose] = useState(project.purpose);
  const [coverUri, setCoverUri] = useState('');
  const [creatorShare, setCreatorShare] = useState(String(project.creatorSharePercent));
  const [publish, setPublish] = useState(!['draft', 'archived'].includes(project.status));
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setDraft(emptyDraft);
    setEditingId('');
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

  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .82 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset?.uri) setCoverUri(asset.uri);
  };

  const projectPayload = (status: CreatorProjectDetails['status']) => ({
    title: title.trim(), story: story.trim(), concept: concept.trim(), region: region.trim(), purpose: purpose.trim(),
    status, coverPath: project.coverPath, creatorSharePercent: Math.min(90, Math.max(50, Number(creatorShare) || 80)), coverUri,
  });

  const saveBasic = async () => {
    if (!title.trim() || !concept.trim() || !region.trim()) { setNotice('프로젝트명, 콘셉트, 활동 지역을 입력해 주세요.'); return; }
    setSaving(true); setNotice('');
    try { await onSaveProject(projectPayload(project.status)); setStep(2); }
    catch (error) { setNotice(friendlyError(error)); } finally { setSaving(false); }
  };

  const editProduct = (item: ProjectProduct) => {
    setEditingId(item.id);
    setDraft({ name: item.name, price: String(item.price), stock: String(item.stock), image: item.image, imagePath: item.imagePath, mode: item.mode, type: item.type, description: item.description || '', material: item.material || '', widthMm: item.widthMm ? String(item.widthMm) : '', heightMm: item.heightMm ? String(item.heightMm) : '', care: item.care || '' });
    setFormOpen(true); setNotice('');
  };

  const saveProduct = async () => {
    const price = Number(draft.price);
    const stock = Number(draft.stock);
    if (!draft.name.trim() || !Number.isInteger(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
      setNotice('상품명·판매가·정수 재고를 확인해 주세요.');
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      const product = { name: draft.name.trim(), price, stock, image: draft.image, imagePath: draft.imagePath, mode: draft.mode, type: draft.type, description: draft.description.trim(), material: draft.material.trim(), widthMm: Number(draft.widthMm) || null, heightMm: Number(draft.heightMm) || null, pickupMode: draft.type === 'artwork' ? 'exhibition' as const : 'immediate' as const, care: draft.care.trim() };
      if (editingId) await onUpdateProduct(editingId, product); else await onSaveProduct(product);
      reset();
    } catch (error) {
      setNotice(friendlyError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={d.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="전시 프로젝트 수정" subtitle={`${step}/3 · ${['기본 정보', '작품·굿즈', '최종 확인'][step - 1]}`} back={() => step === 1 ? onBack() : setStep((step - 1) as 1 | 2 | 3)} />
      <ScrollView ref={scrollRef} style={d.flex} contentContainerStyle={d.editScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <StepProgress current={step} labels={['1 기본', '2 상품', '3 확인']} />
        {step === 1 ? <>
          <View><CuritText weight="bold" style={d.projectTitle}>프로젝트를 소개해 주세요</CuritText><CuritText style={d.description}>공간 운영자가 협업 여부를 판단할 핵심 정보입니다.</CuritText></View>
          <Pressable style={d.coverPicker} onPress={() => { void pickCover(); }}>{coverUri || project.coverUrl ? <Image source={{ uri: coverUri || project.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <><Icon name="discover" color={colors.brand} /><CuritText style={d.hint}>대표 이미지 선택</CuritText></>}</Pressable>
          <Field label="프로젝트명 *" value={title} onChangeText={setTitle} placeholder="예: 흙의 기억" />
          <Field label="한 줄 콘셉트 *" value={concept} onChangeText={setConcept} placeholder="공간에 전달할 분위기를 적어주세요" />
          <Field label="프로젝트 이야기" value={story} onChangeText={setStory} multiline style={d.textarea} />
          <Field label="활동 지역 *" value={region} onChangeText={setRegion} placeholder="예: 서울·경기" />
          <Field label="협업 목적" value={purpose} onChangeText={setPurpose} placeholder="예: 작품 전시 및 판매" />
          {notice ? <CuritText style={d.error}>{notice}</CuritText> : null}<Button label={saving ? '저장 중…' : '저장하고 상품 등록'} disabled={saving} onPress={() => { void saveBasic(); }} />
        </> : null}

        {step === 2 ? <>
        <View><CuritText weight="bold" style={d.projectTitle}>전시할 작품과 굿즈</CuritText><CuritText style={d.description}>각 상품의 판매·수령 조건까지 등록합니다.</CuritText></View>
        <View style={d.productHeading}><CuritText weight="bold" style={d.sectionTitle}>작품 · 굿즈 {products.length}개 *</CuritText></View>
        <View style={d.productStack}>
          {products.map((item, index) => (
            <View key={item.id} style={d.editProductCard}>
              {item.image ? <Image source={{ uri: item.image }} style={d.editThumb} contentFit="cover" /> : <View style={d.smallOrdinal}><CuritText weight="bold" style={d.ordinalText}>{String(index + 1).padStart(2, '0')}</CuritText></View>}
              <View style={d.flex}><CuritText style={d.ordinalLabel}>{ordinal(index)} 상품</CuritText><CuritText weight="semibold">{item.name}</CuritText><CuritText style={d.productMeta}>{item.price.toLocaleString()}원 · 재고 {item.stock}개</CuritText></View>
              <View style={d.row}><Pressable style={d.miniButton} onPress={() => editProduct(item)}><CuritText weight="semibold" style={d.status}>수정</CuritText></Pressable><Pressable style={d.miniButton} onPress={() => { void onDeleteProduct(item.id).catch(error => setNotice(friendlyError(error))); }}><CuritText weight="semibold" style={d.removePhoto}>삭제</CuritText></Pressable></View>
            </View>
          ))}
        </View>

        {!formOpen ? (
          <Pressable style={d.addProductButton} onPress={() => setFormOpen(true)}>
            <CuritText weight="semibold" style={d.status}>＋ {ordinal(products.length)} 상품 추가하기</CuritText>
          </Pressable>
        ) : (
          <View style={d.productForm}>
            <View style={d.formHeader}><CuritText weight="bold" style={d.formTitle}>{editingId ? '상품 수정' : `${ordinal(products.length)} 상품 추가`}</CuritText><Pressable hitSlop={12} onPress={reset}><CuritText style={d.close}>×</CuritText></Pressable></View>
            <Pressable style={d.photoPicker} onPress={() => { void pickImage(); }}>
              <View style={d.photoSlot}>
                {draft.image ? <Image source={{ uri: draft.image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="discover" color={colors.brand} />}
              </View>
              <View style={d.flex}><CuritText weight="semibold">{draft.image ? '상품 사진 변경' : '상품 사진 추가 · 선택'}</CuritText><CuritText style={d.hint}>JPG · PNG · WEBP / 5MB 이하</CuritText></View>
              <Icon name="chevron" size={17} color={colors.brand} />
            </Pressable>
            {draft.image ? <Pressable accessibilityRole="button" hitSlop={10} style={d.removePhotoAction} onPress={() => setDraft(previous => ({ ...previous, image: '' }))}><CuritText style={d.removePhoto}>사진 삭제</CuritText></Pressable> : null}

            <Field label="상품명 *" value={draft.name} onChangeText={name => setDraft(previous => ({ ...previous, name }))} placeholder="예: 검정 머그" />
            <Field label="작품·상품 설명" value={draft.description} onChangeText={description => setDraft(previous => ({ ...previous, description }))} placeholder="작품의 이야기와 특징을 적어주세요" multiline style={d.textarea} />
            <View style={d.formField}><CuritText weight="semibold" style={d.label}>판매 방식 *</CuritText><View style={d.modeRow}>{(['전시·판매', '전시만'] as const).map(mode => <Chip key={mode} label={mode} active={draft.mode === mode} onPress={() => setDraft(previous => ({ ...previous, mode }))} />)}</View></View>
            <View style={d.twoColumns}><View style={d.flex}><Field label="판매가 (원) *" value={draft.price} onChangeText={price => setDraft(previous => ({ ...previous, price: price.replace(/\D/g, '') }))} keyboardType="number-pad" placeholder="15000" /></View><View style={d.flex}><Field label="재고 *" value={draft.stock} onChangeText={stock => setDraft(previous => ({ ...previous, stock: stock.replace(/\D/g, '') }))} keyboardType="number-pad" placeholder="6" /></View></View>
            <View style={d.formField}><CuritText weight="semibold" style={d.label}>상품 유형 *</CuritText><View style={d.twoColumns}><ProductType active={draft.type === 'goods'} title="소형 굿즈" caption="결제 후 현장 수령" onPress={() => setDraft(previous => ({ ...previous, type: 'goods' }))} /><ProductType active={draft.type === 'artwork'} title="원화 · 전시 작품" caption="전시 종료 후 전달" onPress={() => setDraft(previous => ({ ...previous, type: 'artwork' }))} /></View></View>
            <Field label="소재" value={draft.material} onChangeText={material => setDraft(previous => ({ ...previous, material }))} placeholder="예: 세라믹, 패브릭" />
            <View style={d.twoColumns}><View style={d.flex}><Field label="가로(mm)" value={draft.widthMm} onChangeText={widthMm => setDraft(previous => ({ ...previous, widthMm: widthMm.replace(/\D/g, '') }))} keyboardType="number-pad" /></View><View style={d.flex}><Field label="세로(mm)" value={draft.heightMm} onChangeText={heightMm => setDraft(previous => ({ ...previous, heightMm: heightMm.replace(/\D/g, '') }))} keyboardType="number-pad" /></View></View>
            <Field label="관리·설치 주의사항" value={draft.care} onChangeText={care => setDraft(previous => ({ ...previous, care }))} placeholder="파손·오염·설치 조건을 적어주세요" />
            {notice ? <CuritText style={d.error}>{notice}</CuritText> : null}
            <Button label={saving ? '저장 중…' : editingId ? '수정사항 저장' : '상품 저장'} disabled={saving} onPress={() => { void saveProduct(); }} />
          </View>
        )}
        <View style={d.editNotice}><CuritText style={d.hint}>이미 확정된 협업의 가격·공급 조건은 바뀌지 않으며, 변경 내용은 이후 제안부터 적용됩니다.</CuritText></View>
        {!formOpen ? <Button label="다음 · 최종 확인" disabled={!products.length} onPress={() => setStep(3)} /> : null}
        </> : null}
        {step === 3 ? <>
          <View><CuritText weight="bold" style={d.projectTitle}>공개 전 최종 확인</CuritText><CuritText style={d.description}>등록한 정보는 협업 추천과 제안서에 그대로 사용됩니다.</CuritText></View>
          {coverUri || project.coverUrl ? <Image source={{ uri: coverUri || project.coverUrl }} style={d.projectCover} contentFit="cover" /> : null}
          <View style={d.reviewCard}><ReviewRow label="프로젝트" value={title} /><ReviewRow label="콘셉트" value={concept} /><ReviewRow label="지역" value={region} /><ReviewRow label="상품" value={`${products.length}개`} /></View>
          <Field label="작가 판매 배분율(%)" value={creatorShare} onChangeText={value => setCreatorShare(value.replace(/\D/g, ''))} keyboardType="number-pad" />
          <ChoiceGroup title="공개 상태" values={['매칭 모집 공개', '임시 저장']} selected={[publish ? '매칭 모집 공개' : '임시 저장']} onToggle={value => setPublish(value === '매칭 모집 공개')} />
          {notice ? <CuritText style={d.error}>{notice}</CuritText> : null}
          <Button label={saving ? '저장 중…' : publish ? '프로젝트 공개' : '임시 저장'} disabled={saving} onPress={() => { setSaving(true); setNotice(''); void onSaveProject(projectPayload(publish ? 'recruiting' : 'draft')).then(onBack).catch(error => setNotice(friendlyError(error))).finally(() => setSaving(false)); }} />
        </> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProductType({ active, title, caption, onPress }: { active: boolean; title: string; caption: string; onPress: () => void }) {
  return <Pressable style={[d.typeCard, active && d.typeCardActive]} onPress={onPress}><CuritText weight="semibold" style={active ? d.status : undefined}>{title}</CuritText><CuritText style={d.hint}>{caption}</CuritText></Pressable>;
}

export function StoreSignupScreen({ initial, onBack, onComplete, demo = false }: { initial?: StoreOnboarding | null; onBack: () => void; onComplete: (storeName: string) => void; demo?: boolean }) {
  const [step, setStep] = useState(initial?.step ?? 1);
  const [introOpen, setIntroOpen] = useState(true);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [intro, setIntro] = useState(initial?.introduction ?? '');
  const [audience, setAudience] = useState(initial?.targetAudience ?? '');
  const [moods, setMoods] = useState<string[]>(initial?.moodTags ?? []);
  const [purposes, setPurposes] = useState<string[]>(initial?.purposeTags ?? []);
  const [budgetMin, setBudgetMin] = useState(initial?.monthlyBudgetMin?.toString() ?? '');
  const [budgetMax, setBudgetMax] = useState(initial?.monthlyBudgetMax?.toString() ?? '');
  const [photos, setPhotos] = useState<{ uri: string; path: string }[]>(
    (initial?.photoPaths ?? []).map(path => ({ uri: mediaUrl(path), path })),
  );
  const [zones, setZones] = useState<string[]>((initial?.exhibitionZones ?? []).map(zone => zone.type));
  const [zoneWidth, setZoneWidth] = useState(initial?.exhibitionZones[0]?.widthCm?.toString() ?? '');
  const [zoneHeight, setZoneHeight] = useState(initial?.exhibitionZones[0]?.heightCm?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const firstValid = Boolean(name.trim() && address.trim() && intro.trim() && audience.trim());
  const stepValid = step === 1 ? firstValid : step === 2 ? moods.length > 0 && purposes.length > 0 : step === 3 ? photos.length > 0 : step === 4 ? zones.length > 0 : true;

  const toggle = (value: string, current: string[], update: (next: string[]) => void) =>
    update(current.includes(value) ? current.filter(item => item !== value) : [...current, value]);

  const payload = (nextStep: number, complete = initial?.complete ?? false) => ({
    name,
    category,
    address,
    introduction: intro,
    targetAudience: audience,
    moodTags: moods,
    purposeTags: purposes,
    monthlyBudgetMin: budgetMin ? Number(budgetMin) : null,
    monthlyBudgetMax: budgetMax ? Number(budgetMax) : null,
    photoPaths: photos.map(photo => photo.path),
    exhibitionZones: zones.map(type => ({ type, widthCm: zoneWidth ? Number(zoneWidth) : null, heightCm: zoneHeight ? Number(zoneHeight) : null })),
    step: nextStep,
    complete,
  });

  const next = async () => {
    if (!stepValid || busy) return;
    setBusy(true);
    setError('');
    try {
      if (step === 5) {
        if (!demo) await saveStoreOnboarding(payload(5, true));
        onComplete(name.trim());
      } else {
        if (!demo) await saveStoreOnboarding(payload(step + 1));
        setStep(value => value + 1);
      }
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setBusy(false);
    }
  };

  const pickStorePhoto = async () => {
    if (photos.length >= 5 || busy) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.82 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset?.uri) return;
    setBusy(true);
    setError('');
    try {
      const path = demo ? asset.uri : await uploadMedia(asset.uri, 'store', asset.mimeType);
      setPhotos(current => [...current, { uri: asset.uri, path }]);
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setBusy(false);
    }
  };

  const back = () => step === 1 ? onBack() : setStep(value => Math.max(1, value - 1));
  return (
    <KeyboardAvoidingView style={d.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="매장 공간 등록" subtitle={`${step}/5 · ${['기본 정보', '공간 취향', '매장 사진', '전시 구역', '최종 확인'][step - 1]}`} back={back} />
      <ScrollView style={d.flex} contentContainerStyle={d.signupScroll} keyboardShouldPersistTaps="handled">
        <StepProgress current={step} />
        {step === 1 ? <>
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
        </> : null}
        {step === 2 ? <>
          <CuritText weight="bold" style={d.projectTitle}>원하는 공간 분위기를 알려주세요</CuritText>
          <CuritText style={d.description}>선택 내용은 AI 추천의 초기 조건으로 사용됩니다.</CuritText>
          <ChoiceGroup title="선호 분위기 *" values={['따뜻한', '미니멀', '빈티지', '자연', '컬러풀']} selected={moods} onToggle={value => toggle(value, moods, setMoods)} />
          <ChoiceGroup title="협업 목적 *" values={['분위기 전환', '포토존', '빈 공간 활용', '추가 수익', '지역 작가 소개']} selected={purposes} onToggle={value => toggle(value, purposes, setPurposes)} />
          <View style={d.twoColumns}><View style={d.flex}><Field label="최소 예산(원)" value={budgetMin} onChangeText={value => setBudgetMin(value.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="100000" /></View><View style={d.flex}><Field label="최대 예산(원)" value={budgetMax} onChangeText={value => setBudgetMax(value.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="500000" /></View></View>
        </> : null}
        {step === 3 ? <>
          <CuritText weight="bold" style={d.projectTitle}>매장 사진을 등록해 주세요</CuritText>
          <CuritText style={d.description}>전체 공간과 전시 후보 구역이 보이는 사진을 1장 이상 등록해 주세요.</CuritText>
          <View style={d.photoGrid}>{photos.map((photo, index) => <View key={photo.path} style={d.storePhotoWrap}><Image source={{ uri: photo.uri }} style={d.storePhoto} contentFit="cover" /><Pressable accessibilityLabel={`${index + 1}번째 매장 사진 삭제`} accessibilityRole="button" style={d.photoDelete} onPress={() => setPhotos(current => current.filter((_, itemIndex) => itemIndex !== index))}><View style={d.photoDeleteCircle}><CuritText style={d.photoDeleteText}>×</CuritText></View></Pressable></View>)}{photos.length < 5 ? <Pressable accessibilityRole="button" style={d.storePhotoAdd} onPress={() => { void pickStorePhoto(); }}><Icon name="discover" color={colors.brand} /><CuritText style={d.hint}>사진 추가</CuritText></Pressable> : null}</View>
          <CuritText style={d.hint}>JPG · PNG · WEBP, 파일당 5MB 이하 · 최대 5장</CuritText>
        </> : null}
        {step === 4 ? <>
          <CuritText weight="bold" style={d.projectTitle}>전시 가능한 구역을 선택해 주세요</CuritText>
          <CuritText style={d.description}>실제 설치 가능한 공간만 선택하면 추천 실패를 줄일 수 있어요.</CuritText>
          <ChoiceGroup title="전시 구역 *" values={['벽면', '선반', '테이블', '카운터', '창가']} selected={zones} onToggle={value => toggle(value, zones, setZones)} />
          <View style={d.twoColumns}><View style={d.flex}><Field label="가로 크기(cm)" value={zoneWidth} onChangeText={value => setZoneWidth(value.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="120" /></View><View style={d.flex}><Field label="세로 크기(cm)" value={zoneHeight} onChangeText={value => setZoneHeight(value.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="90" /></View></View>
          <View style={d.editNotice}><CuritText style={d.hint}>콘센트, 직사광선, 습기처럼 작품에 영향을 주는 조건은 매칭 제안 단계에서 추가로 확인합니다.</CuritText></View>
        </> : null}
        {step === 5 ? <>
          <CuritText weight="bold" style={d.projectTitle}>등록 내용을 확인해 주세요</CuritText>
          <View style={d.reviewCard}><ReviewRow label="매장" value={`${name} · ${category || '업종 미입력'}`} /><ReviewRow label="주소" value={address} /><ReviewRow label="고객층" value={audience} /><ReviewRow label="분위기" value={moods.join(', ')} /><ReviewRow label="협업 목적" value={purposes.join(', ')} /><ReviewRow label="사진" value={`${photos.length}장`} /><ReviewRow label="전시 구역" value={zones.join(', ')} /></View>
          <View style={d.editNotice}><CuritText style={d.hint}>등록 후에도 마이페이지의 ‘프로필 및 공간 정보’에서 수정할 수 있습니다.</CuritText></View>
        </> : null}
        {error ? <CuritText style={d.error}>{error}</CuritText> : null}
      </ScrollView>
      <View style={d.stickyFooter}><Button label={busy ? '저장 중…' : step === 5 ? '매장 등록 완료' : `다음: ${['', '공간 취향', '매장 사진', '전시 구역', '최종 확인'][step]}`} disabled={!stepValid || busy} onPress={() => { void next(); }} /></View>
    </KeyboardAvoidingView>
  );
}

function ChoiceGroup({ title, values, selected, onToggle }: { title: string; values: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return <View style={d.choiceGroup}><CuritText weight="semibold">{title}</CuritText><View style={d.choiceWrap}>{values.map(value => <Chip key={value} label={value} active={selected.includes(value)} onPress={() => onToggle(value)} />)}</View></View>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <View style={d.reviewRow}><CuritText style={d.hint}>{label}</CuritText><CuritText style={d.reviewValue}>{value || '-'}</CuritText></View>;
}

function RequiredAccordion({ title, open, complete, onPress, children }: { title: string; open: boolean; complete: boolean; onPress: () => void; children: ReactNode }) {
  return <View style={d.accordion}><Pressable style={d.accordionHeader} onPress={onPress}><View style={d.requiredTitle}><CuritText weight="bold">{title}</CuritText><CuritText weight="bold" style={d.requiredStar}>*</CuritText></View><View style={d.accordionRight}><CuritText style={d.hint}>{complete ? '작성 완료' : '필수'}</CuritText><View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}><Icon name="chevron" size={16} color={colors.brand} /></View></View></Pressable>{open ? <View style={d.accordionBody}>{children}</View> : null}</View>;
}

function StepProgress({ current, labels = ['1 정보', '2 취향', '3 사진', '4 구역', '5 확인'] }: { current: number; labels?: string[] }) {
  return <View style={d.steps}>{labels.map((label, index) => { const active = index + 1 <= current; return <View key={label} style={d.step}><View style={[d.stepLine, active && d.stepLineActive]} /><CuritText weight={index + 1 === current ? 'semibold' : 'regular'} style={[d.stepLabel, active && d.status]}>{label}</CuritText></View>; })}</View>;
}

const d = StyleSheet.create({
  flex: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', gap: 4 }, muted: { color: colors.muted }, status: { color: colors.brand },
  detailScroll: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 24 }, editScroll: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28, gap: 22 }, signupScroll: { padding: 20, paddingBottom: 28, gap: 20 },
  projectTitle: { fontSize: 24, lineHeight: 31, marginTop: 8 }, description: { color: colors.muted, marginTop: 12 }, meta: { color: colors.muted, fontSize: 12, marginTop: 14 }, projectCover: { width: '100%', height: 210, borderRadius: radius.lg, marginBottom: 18 }, coverPicker: { width: '100%', height: 190, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C8D3BF', backgroundColor: colors.brandPale, alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  productHeading: { marginTop: 28, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { fontSize: 17 }, hint: { color: colors.muted, fontSize: 11, lineHeight: 17 }, productStack: { gap: 12 },
  detailProductCard: { minHeight: 96, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: '#F8F8F8', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ordinalBox: { width: 44, height: 58, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, smallOrdinal: { width: 46, height: 46, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, ordinalText: { color: colors.brand, fontSize: 17 }, detailThumb: { width: 58, height: 58, borderRadius: 12 }, editThumb: { width: 48, height: 48, borderRadius: 10 }, productName: { fontSize: 15 }, productMeta: { color: colors.muted, fontSize: 11, marginTop: 5 }, pickup: { color: colors.brand, fontSize: 10, marginTop: 5 }, plus: { color: colors.brand, fontSize: 18 },
  conditionCard: { minHeight: 78, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }, publishRow: { minHeight: 56, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  stickyFooter: { flexShrink: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, backgroundColor: colors.surface },
  editProductCard: { minHeight: 76, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: '#F8F8F8', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, ordinalLabel: { color: colors.muted, fontSize: 10, marginBottom: 3 }, miniButton: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, borderRadius: 9, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  addProductButton: { minHeight: 64, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C8D3BF', backgroundColor: '#FAFBF8', alignItems: 'center', justifyContent: 'center' },
  productForm: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16, gap: 16, backgroundColor: colors.surface }, formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, formTitle: { fontSize: 16 }, close: { fontSize: 26, lineHeight: 28 },
  photoPicker: { minHeight: 96, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C8D3BF', borderRadius: radius.md, backgroundColor: colors.brandPale, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' }, photoSlot: { width: 66, height: 66, flexShrink: 0, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, removePhotoAction: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' }, removePhoto: { color: colors.danger, fontSize: 12 },
  formField: { gap: 9 }, label: { fontSize: 13 }, modeRow: { flexDirection: 'row', gap: 8 }, twoColumns: { flexDirection: 'row', gap: 12 }, typeCard: { flex: 1, minHeight: 80, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, gap: 8, justifyContent: 'center' }, typeCardActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft }, error: { color: colors.danger, fontSize: 12 }, editNotice: { padding: 14, backgroundColor: '#F8F8F8', borderRadius: radius.md },
  steps: { flexDirection: 'row', gap: 8 }, step: { flex: 1, gap: 7 }, stepLine: { height: 4, borderRadius: 2, backgroundColor: colors.border }, stepLineActive: { backgroundColor: colors.brand }, stepLabel: { color: colors.muted, fontSize: 10 },
  accordion: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' }, accordionHeader: { minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, requiredTitle: { flexDirection: 'row', alignItems: 'center', gap: 3 }, requiredStar: { color: colors.danger }, accordionRight: { flexDirection: 'row', alignItems: 'center', gap: 9 }, accordionBody: { paddingHorizontal: 12, paddingBottom: 14, gap: 9 }, smallLabel: { fontSize: 12 }, textarea: { minHeight: 104, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 13, fontFamily: fonts.regular, fontSize: 14, color: colors.ink, textAlignVertical: 'top' }, textInput: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 13, fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
  choiceGroup: { gap: 12 }, choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, storePhotoWrap: { width: '30%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden' }, storePhoto: { width: '100%', height: '100%' }, storePhotoAdd: { width: '30%', aspectRatio: 1, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C8D3BF', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.brandPale }, photoDelete: { position: 'absolute', right: 0, top: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, photoDeleteCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center' }, photoDeleteText: { color: colors.surface, fontSize: 18, lineHeight: 20 }, reviewCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 16 }, reviewRow: { minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 }, reviewValue: { flex: 1, textAlign: 'right' },
});
