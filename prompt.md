添付したニュース記事テキストファイルと以下のような JavaScriptのTypeScript形式のテキストエンベディングを Web上で行えるサンプルコードを参考にして ユーザーが検索した言葉に対して 最もベクトル類似度の高い つまりベクトル内積計算の 結果数値の大きいニュース記事をランキング形式で発表する サンプルツールを作成し HTML+CSS+JS 一つのファイルにまとめて出力してください 



UIはシンプルなレスポンシブデザインで作成してください まず画面上に検索 テキストエリア形式の検索ボックスを作成して ユーザーが言葉を打ち込んで検索ボタンを押したタイミングで 添付しているニュース記事テキストファイル10個に対するベクトル 10個と検索したプロンプトのベクトル化を行ってから ベクトル内設計算を行い ニュース記事10個に対するベクトル類自動を出力した後で ベクトル類自動について並べ替え 大基準に並べ替えを行うことで ニュース記事のランキングを表示してください そのほか改良点あれば積極的に改良してください そのほか普通よくある要素があれば積極的に追加してください 目的はテキスト類自動計算のテストなので シンプルでわかりやすいような画面であればそれで良いです







// Copyright 2023 The MediaPipe Authors.



// Licensed under the Apache License, Version 2.0 (the "License");

// you may not use this file except in compliance with the License.

// You may obtain a copy of the License at



//      http://www.apache.org/licenses/LICENSE-2.0



// Unless required by applicable law or agreed to in writing, software

// distributed under the License is distributed on an "AS IS" BASIS,

// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

// See the License for the specific language governing permissions and

// limitations under the License.



import { MDCTextField } from "https://cdn.skypack.dev/@material/textfield";

import { MDCRipple } from "https://cdn.skypack.dev/@material/ripple";

import text from "https://cdn.skypack.dev/@mediapipe/tasks-text@0.10.0";

const { TextEmbedder, FilesetResolver, TextEmbedderResult } = text;



const demosSection: HTMLElement = document.getElementById("demos");



let textEmbedder: TextEmbedder;



// Before we can use TextEmbedder class we must wait for it to finish loading.

async function createEmbedder() {

  const textFiles = await FilesetResolver.forTextTasks(

    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-text@0.10.0/wasm"

  );

  textEmbedder = await TextEmbedder.createFromOptions(textFiles, {

    baseOptions: {

      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/text_embedder/universal_sentence_encoder/float32/1/universal_sentence_encoder.tflite`

    }

  });

  demosSection.classList.remove("invisible");

}

createEmbedder();



const textInput1: MDCTextField = new MDCTextField(

  document.getElementById("textField1")

);

const textInput2: MDCTextField = new MDCTextField(

  document.getElementById("textField2")

);

const calculateBt: HTMLButtonElement = document.getElementById("calculate");

const resultLB: HTMLElement = document.getElementById("result");



calculateBt.addEventListener("click", calculateSimilarity);



async function calculateSimilarity() {

  const text1: string = textInput1.value;

  const text2: string = textInput2.value;



  if (text1 == "" || text2 == "") {

    alert("Please enter text in both boxes to compare");

    return;

  }

  resultLB.innerText = "Computing similarity...";



  // Wait to run the function until inner text is set

  await sleep(5);



  const embeddingResult1: TextEmbedderResult = await textEmbedder.embed(text1);

  const embeddingResult2: TextEmbedderResult = await textEmbedder.embed(text2);



  // Compute cosine similarity.

  const similarity: number = TextEmbedder.cosineSimilarity(

    embeddingResult1.embeddings[0],

    embeddingResult2.embeddings[0]

  );

  resultLB.innerText = similarity.toFixed(2);

}



function sleep(ms) {

  return new Promise((resolve) => setTimeout(resolve, ms));

}