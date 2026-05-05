export interface PromptTemplate {
  id: string
  label: string
}

export interface PromptTemplateResult {
  prompt: string
  negativePrompt?: string
}

export interface BusinessProfileAvatarFields {
  name: string
  role: string
  organization: string
  displayLanguage: 'english' | 'chinese' | 'input' | 'custom'
  customLanguage: string
  notes: string
  textAlign: 'center' | 'left' | 'right'
  footerStyle: 'straight' | 'decorative'
  footerBackground: 'white' | 'lightGray'
  poseStyle: 'front' | 'slightTurn'
  expressionStyle: 'preserve' | 'gentleRefine'
  promptLanguage: 'chinese' | 'english'
}

// ---------------------------------------------------------------------------
// Module-level lookup tables (no per-call object allocation)
// ---------------------------------------------------------------------------

const DISPLAY_LANGUAGE_RULE_ZH: Record<BusinessProfileAvatarFields['displayLanguage'], string | ((lang: string) => string)> = {
  english:
    '请将姓名、身份/职位、专业/部门/机构等所有需要显示在图片上的文字翻译成自然、准确、正式的英文后再放入图片中。除非用户明确要求保留中文，否则图片中不要显示中文文字。',
  chinese:
    '请将姓名、身份/职位、专业/部门/机构等所有需要显示在图片上的文字统一使用自然、正式、准确的中文放入图片中。',
  input:
    '请根据用户输入内容的原始语言来显示图片文字；如果同一字段混合多种语言，请优先使用用户输入中最主要的语言，并保持自然、正式、准确。',
  custom: (lang: string) =>
    `请将姓名、身份/职位、专业/部门/机构等所有需要显示在图片上的文字翻译或整理为自然、准确、正式的${lang}后再放入图片中。`,
}

const DISPLAY_LANGUAGE_RULE_EN: Record<BusinessProfileAvatarFields['displayLanguage'], string | ((lang: string) => string)> = {
  english:
    'Translate or write all visible text, including name, role/title, department, and organization, in natural, accurate, formal English. Do not show Chinese text unless the user explicitly asks to keep it.',
  chinese:
    'Write all visible text, including name, role/title, department, and organization, in natural, formal, accurate Chinese.',
  input:
    'Display the visible text in the original language entered by the user. If a field mixes multiple languages, use the dominant input language and keep the wording natural, formal, and accurate.',
  custom: (lang: string) =>
    `Translate or adapt all visible text, including name, role/title, department, and organization, into natural, accurate, formal ${lang}.`,
}

const TEXT_ALIGN_LABEL_ZH: Record<BusinessProfileAvatarFields['textAlign'], string> = {
  center: '居中对齐',
  left: '居左对齐',
  right: '居右对齐',
}

const TEXT_ALIGN_LABEL_EN: Record<BusinessProfileAvatarFields['textAlign'], string> = {
  center: 'center-aligned',
  left: 'left-aligned',
  right: 'right-aligned',
}

const FOOTER_STYLE_RULE_ZH: Record<BusinessProfileAvatarFields['footerStyle'], string> = {
  straight:
    '底部信息栏必须使用平直、规整、稳定的矩形或简洁直线布局，不要使用波浪、斜切、弧形、丝带、曲线遮罩或任何会切入人物身体的艺术化底边。人物下半身、西装肩线和躯干轮廓必须保持完整、平整、自然，不要被底部信息栏不规则遮挡。',
  decorative:
    '底部信息栏可以有轻微高级感装饰，但必须非常克制，不要明显切入人物身体，不要破坏西装肩线、躯干轮廓或正式证件照质感。',
}

const FOOTER_STYLE_RULE_EN: Record<BusinessProfileAvatarFields['footerStyle'], string> = {
  straight:
    'The bottom information area must use a straight, regular, stable rectangle or clean straight-line layout. Do not use waves, diagonal cuts, arcs, ribbons, curved masks, or any decorative lower edge that cuts into the person. The lower torso, suit shoulders, and body outline must remain complete, level, natural, and unobstructed by irregular footer shapes.',
  decorative:
    'The bottom information area may include very subtle premium decoration, but it must be restrained. It must not noticeably cut into the person, damage the suit shoulder line or torso outline, or reduce the formal ID-photo feel.',
}

const FOOTER_BG_RULE_ZH: Record<BusinessProfileAvatarFields['footerBackground'], string> = {
  white:
    '底部信息栏背景颜色应与整体白色背景保持一致或高度接近，干净无色块感，与人像背景自然衔接。',
  lightGray:
    '底部信息栏可以使用非常浅的灰白色背景（类似 #f5f5f5 至 #f8f8f8 的轻微灰色），用于柔和区分文字区域，但必须简洁、平整、专业，不要使用明显渐变或花纹。',
}

const FOOTER_BG_RULE_EN: Record<BusinessProfileAvatarFields['footerBackground'], string> = {
  white:
    'The footer background should match or closely match the overall white background, staying clean and seamless with no obvious color-block effect.',
  lightGray:
    'The footer may use a very light gray-white background, similar to #f5f5f5 to #f8f8f8, to softly separate the text area. Keep it flat, clean, professional, and avoid obvious gradients or patterns.',
}

const POSE_STYLE_RULE_ZH: Record<BusinessProfileAvatarFields['poseStyle'], string> = {
  front:
    '人物保持正面半身肖像姿态，身体和脸部基本正对镜头，端正、稳定、正式，类似专业证件照或企业官网头像。',
  slightTurn:
    '人物可以采用类似 Apple 官网高管头像的轻微侧身姿态：身体可轻微转向一侧，肩线自然形成轻微角度，但脸部仍应自然看向镜头，身份特征清晰可辨，整体保持正式、亲和、专业，不要夸张侧脸或大幅转身。',
}

const POSE_STYLE_RULE_EN: Record<BusinessProfileAvatarFields['poseStyle'], string> = {
  front:
    'Use a front-facing half-body portrait pose. The body and face should basically face the camera, upright, stable, and formal, similar to a professional ID photo or corporate profile portrait.',
  slightTurn:
    'Use a subtle Apple-style executive portrait pose: the body may turn slightly to one side with a natural shoulder angle, while the face still looks naturally at the camera. Keep the identity clearly recognizable, professional, friendly, and not exaggerated; no strong profile view or dramatic body turn.',
}

const EXPRESSION_STYLE_RULE_ZH: Record<BusinessProfileAvatarFields['expressionStyle'], string> = {
  preserve:
    '尽量保持参考照片中的原始面部表情，只做自然、轻微的商务形象优化，不要改变人物身份感。',
  gentleRefine:
    '如果参考照片中的面部表情显得僵硬、疲惫、呆板或缺少神韵，可以适当优化为更自然、放松、自信、亲和的商务表情；可轻微改善眼神、嘴角和面部状态，但不要夸张微笑，不要改变五官比例、脸型基础或人物身份。',
}

const EXPRESSION_STYLE_RULE_EN: Record<BusinessProfileAvatarFields['expressionStyle'], string> = {
  preserve:
    "Preserve the original facial expression from the reference photo as much as possible, with only natural, subtle business-image refinement. Do not change the person's identity.",
  gentleRefine:
    "If the reference photo's facial expression looks stiff, tired, dull, or lacks presence, gently refine it into a more natural, relaxed, confident, and approachable business expression. You may subtly improve the eyes, mouth corners, and facial energy, but do not create an exaggerated smile or change facial proportions, base face shape, or identity.",
}

const BUSINESS_PROFILE_AVATAR_NEGATIVE_PROMPT = [
  'website screenshot, browser window, webpage UI, directory page, profile listing page',
  'resume page, CV page, biography page, form fields, table layout, spreadsheet layout',
  'QR code, contact card, email address, phone number, website URL, social media handle',
  'extra labels, metadata labels, field labels, duplicated text, unrelated text blocks, profile metadata',
  '姓名标签, 身份标签, 职位标签, 专业标签, 部门标签, 机构标签, 简历页面, 个人主页, 网页截图, 二维码, 联系方式',
].join(', ')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeDisplayText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Returns empty string for blank/none-like inputs so they are omitted from the poster. */
function normalizeOptionalDisplayText(value: unknown): string {
  const text = normalizeDisplayText(value)
  if (!text) return ''
  const lower = text.toLowerCase()
  if (['无', 'none', 'n/a', 'na', 'null', 'nil', '-'].includes(lower)) return ''
  return text
}

function resolveLanguageRule(
  table: Record<BusinessProfileAvatarFields['displayLanguage'], string | ((lang: string) => string)>,
  displayLanguage: BusinessProfileAvatarFields['displayLanguage'],
  customLang: string,
): string {
  const entry = table[displayLanguage]
  return typeof entry === 'function' ? entry(customLang || '用户指定语言') : entry
}

// ---------------------------------------------------------------------------
// Main builders
// ---------------------------------------------------------------------------

function resolveBusinessProfileAvatarFields(fields: Partial<BusinessProfileAvatarFields> = {}) {
  const {
    name = '',
    role = '',
    organization = '',
    displayLanguage = 'english',
    customLanguage = '',
    notes = '',
    textAlign = 'center',
    footerStyle = 'straight',
    footerBackground = 'white',
    poseStyle = 'front',
    expressionStyle = 'preserve',
    promptLanguage = 'chinese',
  } = fields

  const displayName = normalizeDisplayText(name) || '[姓名]'
  const displayRole = normalizeOptionalDisplayText(role)
  const displayOrganization = normalizeOptionalDisplayText(organization)
  const displayNotes = normalizeDisplayText(notes)
  const customLang = normalizeDisplayText(customLanguage)

  return {
    displayName,
    displayRole,
    displayOrganization,
    displayNotes,
    customLang,
    displayLanguage,
    footerStyle,
    footerBackground,
    poseStyle,
    expressionStyle,
    promptLanguage,
    textAlign,
  }
}

export function buildBusinessProfileAvatarPrompt(fields: Partial<BusinessProfileAvatarFields> = {}): string {
  const {
    displayName,
    displayRole,
    displayOrganization,
    displayNotes,
    customLang,
    displayLanguage,
    footerStyle,
    footerBackground,
    poseStyle,
    promptLanguage,
    textAlign,
  } = resolveBusinessProfileAvatarFields(fields)

  if (promptLanguage === 'english') {
    const langRule = resolveLanguageRule(DISPLAY_LANGUAGE_RULE_EN, displayLanguage, customLang || 'the user-specified language')

    const textLines = [
      `Name: ${displayName}`,
      displayRole ? `Role/Title: ${displayRole}` : '',
      displayOrganization ? `Department/Organization: ${displayOrganization}` : '',
    ].filter(Boolean).join('\n')

    const notesSection = displayNotes
      ? `\nAdditional notes (use only as generation guidance; do not display this as poster text unless the note explicitly asks to show it): ${displayNotes}`
      : ''

    return `Create a formal business profile avatar poster based on the uploaded portrait photo. Preserve the person's true identity traits, facial feature proportions, base face shape, and overall temperament. Do not change the person's identity.

You may moderately refine the facial contour to make the face lines clearer, more natural, and more photogenic. Smooth skin texture, reduce blemishes, dullness, and uneven skin tone, but do not over-retouch. Preserve real skin details and natural lighting.

Design a matching business hairstyle based on the person's face shape. The hairstyle should be clean, mature, professional, suitable for formal occasions, natural, layered, and not exaggerated. Dress the person in formal business attire, such as a dark suit jacket with a white or light-colored shirt, optionally with a tie. The overall look should be premium, simple, professional, and trustworthy.

The image should be a half-body portrait with the person centered and naturally confident.

Pose requirement: ${POSE_STYLE_RULE_EN[poseStyle]}

Use a pure white plain background with soft, even lighting, similar to a professional ID photo, corporate avatar photo, or university website faculty profile photo. Overall style: clean, formal, business, high-definition realistic photography. Square 1:1 aspect ratio.

Reserve a clean information area at the bottom and add modern minimalist typography. Only display the non-empty fields listed below. If role/title, department/organization, or similar fields are empty, None, N/A, not provided, or equivalent, do not show the corresponding label or value. Do not display None, N/A, blank placeholders, or similar filler text:
${textLines}${notesSection}

Footer area style requirement: ${FOOTER_STYLE_RULE_EN[footerStyle]}
Footer background requirement: ${FOOTER_BG_RULE_EN[footerBackground]}

Strict border rule: Do not add any outer border, frame, stroke, black outline, gray outline, card border, image border, photo border, or decorative edge around the whole image or the poster. The final image must have clean edges with no visible border lines.

Visible text language rule: ${langRule}

Typography requirement:
Use dark navy bold large-size text for the first line with the name. If a second or third line exists, use black regular-size text. Keep the name, role, title, department, and organization text ${TEXT_ALIGN_LABEL_EN[textAlign]}. The layout should resemble a university website profile, academic conference speaker card, or professional business avatar poster.`
  }

  // Chinese prompt
  const langRule = resolveLanguageRule(DISPLAY_LANGUAGE_RULE_ZH, displayLanguage, customLang)

  const textLines = [
    `姓名：${displayName}`,
    displayRole ? `身份/职位：${displayRole}` : '',
    displayOrganization ? `专业/部门/机构：${displayOrganization}` : '',
  ].filter(Boolean).join('\n')

  const notesSection = displayNotes
    ? `\n额外备注（仅作为生成要求理解，不要直接作为海报文字显示，除非备注中明确要求显示）：${displayNotes}`
    : ''

  return `请基于我上传的人像照片生成一张正式商务档案头像海报，保留人物真实身份特征、五官比例、脸型基础和整体气质，不要改变人物身份。

可以适度优化面部轮廓，使脸部线条更清晰、自然、上镜；平滑皮肤质感，减少瑕疵、暗沉和肤色不均，但不要过度磨皮，保留真实皮肤细节和自然光影。

请根据人物脸型设计一款匹配的商务发型。发型应干净利落、成熟专业、适合正式场合，发丝自然、有层次、不夸张。请为人物搭配正式商务穿搭，例如深色西装外套、白色或浅色衬衫，可搭配领带。整体造型应高级、简洁、专业、可信赖。

画面为半身肖像，人物居中，表情自然自信。

姿态要求：${POSE_STYLE_RULE_ZH[poseStyle]}

背景为纯白色素色背景，光线柔和均匀，类似专业证件照、企业头像摄影或大学官网个人档案照。整体风格干净、正式、商务、高清写实摄影质感，方形比例 1:1。

画面下方预留简洁信息栏，并添加现代简洁排版文字。只显示下面列出的非空字段；如果身份/职位、专业/部门/机构等字段为空、无、None、N/A 或未提供，请不要在图片中显示对应标签和值，也不要显示 None、无、N/A、空白占位或类似文字：
${textLines}${notesSection}

底部信息栏样式要求：${FOOTER_STYLE_RULE_ZH[footerStyle]}
底部信息栏背景要求：${FOOTER_BG_RULE_ZH[footerBackground]}

严格边框规则：不要添加任何外边框、相框、描边、黑色线框、灰色线框、卡片边框、图片边框、照片边框或围绕整张图/海报的装饰边缘。最终图片边缘必须干净，没有可见边框线。

重要文字规则：${langRule}

排版要求：
第一行姓名使用深蓝色粗体大字号文字；如果存在第二行、第三行，则使用黑色常规字号文字。姓名、身份、职位、专业、部门、机构等文字整体${TEXT_ALIGN_LABEL_ZH[textAlign]}。整体排版参考大学官网个人档案、学术会议人物介绍卡片或专业商务头像海报风格。`
}

export function buildBusinessProfileAvatarPromptV2(fields: Partial<BusinessProfileAvatarFields> = {}): string {
  const { expressionStyle, promptLanguage } = resolveBusinessProfileAvatarFields(fields)
  const basePrompt = buildBusinessProfileAvatarPrompt(fields)

  return promptLanguage === 'english'
    ? `${basePrompt}

Facial expression requirement:
${EXPRESSION_STYLE_RULE_EN[expressionStyle]}`
    : `${basePrompt}

面部表情要求：
${EXPRESSION_STYLE_RULE_ZH[expressionStyle]}`
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'business-profile-avatar-poster',
    label: '正式商务档案头像海报 / Business Profile Avatar Poster',
  },
  {
    id: 'business-profile-avatar-poster-v2',
    label: '正式商务档案头像海报 v2 / Business Profile Avatar Poster v2',
  },
]

export function buildBusinessProfileAvatarNegativePrompt(): string {
  return BUSINESS_PROFILE_AVATAR_NEGATIVE_PROMPT
}

export const PROMPT_TEMPLATE_OPTIONS = PROMPT_TEMPLATES.map((t) => ({
  value: t.id,
  label: t.label,
}))
