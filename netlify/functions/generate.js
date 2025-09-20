// このNetlify Functionは、フロントエンドからのリクエストを受け取り、
// 安全に保管されたAPIキーを使ってGoogle Gemini APIを呼び出します。
exports.handler = async (event) => {
    // POSTリクエスト以外は受け付けない
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 環境変数からAPIキーを取得
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return { statusCode: 500, body: JSON.stringify({ error: 'APIキーが設定されていません。' }) };
    }
    
    // APIエンドポイントのURL
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;

    try {
        // リクエストボディをパース
        const { prompt, image } = JSON.parse(event.body);

        if (!prompt || !image) {
            return { statusCode: 400, body: JSON.stringify({ error: 'プロンプトまたは画像がありません。' }) };
        }
        
        // Geminiに送信するペイロードを作成
        const payload = {
            contents: [{
                parts: [
                    { text: `掛け軸の画像を背景に合成してください。背景の指示は「${prompt}」です。` },
                    { inlineData: { mimeType: "image/png", data: image } }
                ]
            }],
            generationConfig: {
                responseModalities: ['IMAGE']
            },
        };
        
        // GoogleのAPIにリクエストを送信
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorData = await apiResponse.json();
            console.error('Google API Error:', errorData);
            return { statusCode: apiResponse.status, body: JSON.stringify({ error: 'Google APIからの応答エラーです。' }) };
        }

        const result = await apiResponse.json();
        
        // レスポンスから画像データを抽出
        const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

        if (!base64Data) {
            console.error('No image data in response:', result);
            return { statusCode: 500, body: JSON.stringify({ error: 'AIからのレスポンスに画像データが含まれていませんでした。' }) };
        }
        
        // 成功レスポンスを返す
        return {
            statusCode: 200,
            body: JSON.stringify({ base64: base64Data }),
        };

    } catch (error) {
        console.error('Internal Server Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'サーバー内部でエラーが発生しました。' }) };
    }
};

