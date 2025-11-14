// === DOM Elements ===
const searchButton = document.getElementById('search-button');
const searchQuery = document.getElementById('search-query');
const resultsContainer = document.getElementById('results-container');
const statusDiv = document.getElementById('status');

// === Config ===
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'; // 公式モデル名。 [oai_citation:2‡OpenAI Platform](https://platform.openai.com/docs/models/text-embedding-3-small?utm_source=chatgpt.com) [oai_citation:3‡OpenAI](https://openai.com/index/new-embedding-models-and-api-updates/?utm_source=chatgpt.com)
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/embeddings';

// === Data: News Articles (10) ===
// 元の配列をそのまま使用
const articles = [
  {
    title: "ウィンブルドン女子ダブルス、日本人ペア敗退",
    content: "【ウィンブルドン共同】テニスのウィンブルドン選手権第４日は３日、ロンドン郊外のオールイングランド・クラブで行われ、女子ダブルス１回戦で内島萌夏（安藤証券）アンナ・ボンダル（ハンガリー）組は第１シードのカテリナ・シニアコバ（チェコ）テーラー・タウンゼント（米国）組に４―６、１―６で敗れた。加藤未唯（ザイマックス）クリスティナ・ブクサ（スペイン）組はイタリアのペアに屈した。 男子シングルス２回戦では第１シードのヤニク・シナー（イタリア）、第６シードのノバク・ジョコビッチ（セルビア）がともにストレート勝ちした。"
  },
  {
    title: "令和２年７月豪雨から５年、熊本で追悼",
    content: "九州５県で災害関連死を含め計７９人が犠牲になった２０２０年７月の豪雨から、４日で５年となった。球磨川や支流が氾濫し、特別養護老人ホーム「千寿園」の入所者１４人を含む２５人が死亡した熊本県球磨村では、午前８時半にサイレンが鳴り、住民らが黙とうして祈りをささげた。 村には献花台が設けられ、松谷浩一村長が献花。 隣接する八代市を流れる球磨川の河川敷では、氾濫が起きた早朝に合わせて、住民ら約３０人が地元の風習にならい「安穏なれ」「一日も早い復興を」などと願いを書いた石を川に投げ入れた。行事を企画した道野紗喜子さん（４６）は知人ら４人を水害で失ったといい、「将来の災害に備えるため、風化はさせたくない」と話した。 ２０年７月の豪雨では、梅雨前線の停滞や線状降水帯の発生により、各地で川が氾濫。４日未明に大雨特別警報が発令された熊本県では６７人が死亡、いまも２人が行方不明となっている。家屋７千棟超が被害を受け、６月３０日時点で２７戸４９人が仮設住宅などに入居している。 球磨村の人口は豪雨前に比べ半減した。"
  },
  {
    title: "大リーグ６月の月間ＭＶＰ発表",
    content: "【ロサンゼルス共同】米大リーグ機構は３日、６月の月間最優秀選手（ＭＶＰ）を発表し、野手部門でア・リーグは打率３割、１１本塁打、２７打点をマークしたマリナーズの捕手ローリー、ナ・リーグは打率３割２分２厘、１１本塁打、２０打点だったメッツの外野手ソトがともに初めて選ばれた。 投手部門はアが５試合で１勝０敗、防御率１・１９を記録したアストロズのブラウンが初選出。ナは５試合で２勝１敗、防御率０・５８のフィリーズのウィーラーが２度目の受賞を果たした。 月間最優秀新人はアがアスレチックスの一塁手カーツ、ナがブルワーズの先発右腕ミジオロウスキーだった。"
  },
  {
    title: "大阪で６８歳女性死亡、首に絞められた痕",
    content: "３日午後９時ごろ、大阪府大東市の住宅で「３階で母親が亡くなっている」と、帰宅した息子から親族を通じて１１０番があった。駆け付けた警察官が布団であおむけに倒れている女性を発見し、現場で死亡が確認された。 四條畷署によると、女性はこの家に住む佐藤和子さん（６８）。首に絞められたような痕があり、殺人事件の可能性もあるとみて捜査する。佐藤さんの夫と連絡が取れておらず、何らかの事情を知っているとみて行方を捜している。住宅は施錠され、家の中にはロープがあった。"
  },
  {
    title: "米イラン、来週核協議か　攻撃後初、オスロで",
    content: "【ワシントン、テヘラン共同】米ニュースサイト、アクシオスは３日、米国のウィットコフ中東担当特使が来週、ノルウェー・オスロで、イランのアラグチ外相と核問題を巡る協議を開く方向で準備を進めていると報じた。実現すれば米軍によるイラン核施設攻撃後、初の直接協議となる。関係者の話として伝えた。 トランプ米大統領は今週にイランとの協議が開かれると述べていた。米政府はイランの核開発計画の放棄を含む包括的な和平合意を目指しているが、イラン側との立場の隔たりは大きく、交渉が進展するかどうかは予断を許さない。 イラン外交筋は３日、米国との核協議は「検討中」だと述べた。"
  },
  {
    title: "プーチン氏、侵攻目的放棄せず　トランプ氏と電話会談",
    content: "【モスクワ共同】ロシアのプーチン大統領は３日、トランプ米大統領と電話会談した。ロシア側によると、トランプ氏がウクライナでの早期の戦闘終結を求めたのに対し、プーチン氏は紛争の原因を除去するという侵攻目的を放棄することはないと強調した。和平の条件としてウクライナのＮＡＴＯ加盟断念などを改めて求めた形となった。 ロシアのウシャコフ大統領補佐官によると、プーチン氏はウクライナと交渉を継続する用意があると説明。米国がウクライナへの武器供給を一時停止したことについては話し合わなかったという。 中東情勢も協議し、プーチン氏は外交を通じて解決することが重要だと指摘した。 電話は約１時間に及んだ。"
  },
  {
    title: "プーチン氏とトランプ氏が電話会談　ウクライナ和平など協議か",
    content: "【モスクワ共同】タス通信によると、ロシアのペスコフ大統領報道官は３日、プーチン大統領とトランプ米大統領が電話会談したと明らかにした。両首脳の電話会談は６月１４日以来で、ウクライナ和平や中東情勢について協議したとみられる。 米ロ首脳の電話会談は、トランプ氏が今年１月に２期目に就任した後で正式発表されているだけでも６回目。"
  },
  {
    title: "シカゴで銃乱射、４人死亡　パーティー会場前",
    content: "【ニューヨーク共同】米中西部イリノイ州シカゴの繁華街で２日夜、銃乱射事件があり、２０代の男女４人が死亡、２０～３０代の１４人が負傷して病院に搬送された。米メディアが伝えた。 黒人や性的少数者らに人気がある女性ラッパーのアルバム発表を祝うパーティーが開かれていた飲食店前の路上で、何者かが銃を乱射し、車で逃走した。犯人は３人組との目撃情報もある。 同じ店の前で２０２２年１１月にも１人が死亡、３人が負傷する銃撃事件が起きていた。"
  },
  {
    title: "ウクライナへのミサイル輸送停止　米の兵器供給一部停止で",
    content: "【キーウ、ワシントン共同】米紙ウォールストリート・ジャーナル（ＷＳＪ）は２日、米政権がウクライナへの兵器供給の一部停止を決めたことを受け、隣国ポーランドに搬入済みの防空システム「パトリオット」用ミサイルのウクライナへの輸送が停止されたと報じた。ロシアは攻撃を激化させており、防空兵器不足が被害拡大を招く恐れがある。 ウクライナのゼレンスキー大統領は２日、「米国と防空を含む防衛支援について協議をしている。われわれは国民の安全を守らないといけない」と述べた。３日には、兵器供給停止に関して「明日か、近日中にトランプ米大統領と協議したい」と表明した。"
  },
  {
    title: "中国、レアアース輸出で融和姿勢　「欧州の需要満たせる」",
    content: "【ベルリン共同】中国の王毅外相は３日、ベルリンで記者会見し、レアアースの輸出規制を巡り、規則に基づいた申請があれば「欧州やドイツの需要を満たすことができる」と述べた。欧州で輸出規制への懸念が強まる中、融和姿勢を強調した。 同席したドイツのワーデフール外相は輸出規制を「一方的で透明性に欠ける」と批判。王氏は、レアアースが「民生用と軍事用の両方に使われる」として輸出管理の必要があると主張した。 ワーデフール氏は、ウクライナ侵攻を続けるロシアに対する中国の協力関係に懸念を表明し、戦争継続に「重要な物品」を供給しないよう求めた。王氏は「紛争当事者に殺傷能力の高い兵器は供給していない」と話した。"
  }
];

// === State ===
let cachedArticleEmbeddings = null; // 一度だけ作ってキャッシュ
let isEmbeddingInProgress = false;

// === Small helper: get API key (prompt once, store in localStorage) ===
function getApiKey() {
  let key = localStorage.getItem('openai_api_key') || '';
  if (!key) {
    key = window.prompt('OpenAI APIキーを入力してください（ブラウザ保存：localStorage）:');
    if (key) localStorage.setItem('openai_api_key', key);
  }
  if (!key) throw new Error('APIキーが設定されていません。');
  return key;
}

// === Embedding via OpenAI REST API ===
// NOTE: 本番では必ずバックエンド経由で呼び出してください。 [oai_citation:4‡OpenAI Help Center](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety?utm_source=chatgpt.com)
async function embedTexts(texts) {
  const apiKey = getApiKey();

  const res = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: texts // 文字列の配列で一括ベクトル化
    })
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Embeddings API error (${res.status}): ${msg}`);
  }

  const json = await res.json();
  // json.data は { embedding: number[] } の配列
  return json.data.map(item => item.embedding);
}

// === Cosine Similarity ===
function cosineSimilarity(a, b) {
  let dot = 0.0;
  let na = 0.0;
  let nb = 0.0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1e-12;
  return dot / denom;
}

// === UI: Render results ===
function displayResults(results) {
  resultsContainer.innerHTML = '';
  results.forEach((result, index) => {
    const rank = index + 1;
    const snippet = result.content.substring(0, 120) + '...';

    let badgeColor = 'bg-red-100 text-red-800';
    if (result.similarity > 0.5) badgeColor = 'bg-green-100 text-green-800';
    else if (result.similarity > 0.25) badgeColor = 'bg-yellow-100 text-yellow-800';

    const el = document.createElement('div');
    el.className = 'result-item bg-white p-5 rounded-xl shadow-md border border-gray-200';
    el.style.animationDelay = `${index * 100}ms`;
    el.innerHTML = `
      <div class="flex items-start justify-between">
        <h3 class="text-lg font-bold text-gray-800 mb-2">${rank}位: ${result.title}</h3>
        <span class="text-sm font-medium px-2.5 py-0.5 rounded-full ${badgeColor}">
          類似度: ${result.similarity.toFixed(4)}
        </span>
      </div>
      <p class="text-gray-600">${snippet}</p>
    `;
    resultsContainer.appendChild(el);
  });
}

// === Main search flow ===
async function performSearch() {
  const query = searchQuery.value.trim();
  if (!query) {
    alert('検索キーワードを入力してください。');
    return;
  }
  if (isEmbeddingInProgress) return;

  try {
    searchButton.disabled = true;
    statusDiv.textContent = cachedArticleEmbeddings
      ? '類似度を計算中...'
      : '記事の埋め込みを作成中...（初回のみ）';

    // 1) 記事側の埋め込みを初回だけ作成・キャッシュ（配列まとめて一括送信）
    if (!cachedArticleEmbeddings) {
      isEmbeddingInProgress = true;
      const articleTexts = articles.map(a => a.content);
      cachedArticleEmbeddings = await embedTexts(articleTexts); // ← バッチ埋め込み  [oai_citation:5‡OpenAI Platform](https://platform.openai.com/docs/guides/embeddings?utm_source=chatgpt.com)
      isEmbeddingInProgress = false;
    }

    // 2) クエリを埋め込み
    const [queryEmbedding] = await embedTexts([query]);

    // 3) 類似度を算出
    const results = articles.map((article, i) => {
      const sim = cosineSimilarity(queryEmbedding, cachedArticleEmbeddings[i]);
      return { ...article, similarity: sim };
    });

    // 4) 降順にソートして表示
    results.sort((a, b) => b.similarity - a.similarity);
    displayResults(results);
    statusDiv.textContent = `「${query}」の検索結果`;
  } catch (err) {
    console.error(err);
    statusDiv.textContent = '計算中にエラーが発生しました。コンソールを確認してください。';
    alert(err.message);
  } finally {
    searchButton.disabled = false;
  }
}

// === Event listeners ===
searchButton.addEventListener('click', performSearch);
searchQuery.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    performSearch();
  }
});

// 初期表示
statusDiv.textContent = '検索キーワードを入力してください。';