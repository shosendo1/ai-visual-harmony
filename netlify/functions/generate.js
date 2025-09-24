// netlify/functions/generate.js

// どの住所（オリジン）からの通信も許可するための「特別な許可証」(CORSヘッダー)
// これが、この開発画面からの通信を許可するための、唯一かつ最も重要な部分です。
const headers = {
  'Access-Control-Allow-Origin': '*', // すべてのオリジン（住所）を許可します
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // 許可する通信の種類です
};

exports.handler = async (event) => {
    // ブラウザからの「この通信は安全ですか？」という事前の確認に応答します。
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204, // 「問題ありません、どうぞ」という意味です
            headers,
            body: '',
        };
    }

    // POSTという種類の通信以外は受け付けません。
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: '許可されていない通信方法です。' })
        };
    }

    try {
        // --- ここから先は、これまでと全く同じ、正常に動作していた画像生成の処理です ---
        const { prompt, image } = JSON.parse(event.body);
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'APIキーがサーバーに設定されていません。' })
            };
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{
                parts: [
                    { text: `A realistic, high-quality photograph of a Japanese hanging scroll (kakejiku) with the following artwork, placed in this setting: ${prompt}. The artwork on the scroll is:` },
                    { inlineData: { mimeType: "image/png", data: image } }
                ]
            }],
        };

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('Google API Error:', errorText);
            throw new Error(`Google APIからエラーが返されました。APIキーまたは請求設定をご確認ください。`);
        }

        const result = await apiResponse.json();
        const part = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        const base64Data = part?.inlineData?.data;
        
        if (!base64Data) {
            console.error('No image data in response:', JSON.stringify(result, null, 2));
            throw new Error('AIは画像を生成できませんでした。プロンプトを具体的にしてみてください。');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ base64: base64Data }),
        };

    } catch (error) {
        console.error('Error in Netlify function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'サーバーで不明なエラーが発生しました。' }),
        };
    }
};
