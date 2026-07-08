import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractDriveFileId(url: string): string | null {
  const fileMatch = url.match(/\/file\/d\/([^\/?]+)/);
  if (fileMatch) return fileMatch[1];
  const openMatch = url.match(/[?&]id=([^&]+)/);
  if (openMatch) return openMatch[1];
  const ucMatch = url.match(/uc\?[^&]*id=([^&]+)/);
  if (ucMatch) return ucMatch[1];
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ());
    const { url } = body;
    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing url parameter', detail: body }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileId = extractDriveFileId(url);
    if (!fileId) {
      return new Response(JSON.stringify({ error: 'Invalid Google Drive URL', url }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    console.log(`Fetching Google Drive: ${driveUrl}`);
    const driveResponse = await fetch(driveUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    });

    console.log(`Google Drive response status: ${driveResponse.status}`);
    console.log(`Google Drive content-type: ${driveResponse.headers.get('content-type')}`);

    if (!driveResponse.ok) {
      const bodyText = await driveResponse.text().catch(() => '');
      return new Response(
        JSON.stringify({ error: `Failed to fetch from Google Drive: ${driveResponse.status}`, bodyPreview: bodyText.slice(0, 200) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const contentType = driveResponse.headers.get('content-type') || 'image/jpeg';
    const contentLength = driveResponse.headers.get('content-length');
    console.log(`Content-Type: ${contentType}, Size: ${contentLength}`);

    if (contentType.includes('text/html')) {
      const bodyText = await driveResponse.text();
      console.log(`Got HTML response from Google Drive. Preview: ${bodyText.slice(0, 300)}`);
      return new Response(
        JSON.stringify({ error: 'Google Drive returned HTML instead of image. The file may be too large or blocked by virus scan.', preview: bodyText.slice(0, 200) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const imageBlob = await driveResponse.blob();
    console.log(`Image blob size: ${imageBlob.size} bytes`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    console.log(`Supabase URL: ${supabaseUrl ? 'set' : 'MISSING'}, Key: ${supabaseKey ? 'set (length ' + supabaseKey.length + ')' : 'MISSING'}`);

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase credentials in edge function environment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const bucketName = 'announcement-images';
    const filePath = `gdrive-${fileId}-${Date.now()}.jpg`;

    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.log(`List buckets error: ${listError.message}`);
    }
    const exists = buckets?.some((b) => b.name === bucketName);
    console.log(`Bucket exists: ${exists}`);

    if (!exists) {
      console.log(`Creating bucket: ${bucketName}`);
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/*'],
      });
      if (createError) {
        console.log(`Create bucket error: ${createError.message}`);
      }
    }

    console.log(`Uploading to ${bucketName}/${filePath}`);
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, imageBlob, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.log(`Upload error: ${uploadError.message}`);
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    console.log(`Public URL: ${publicUrlData.publicUrl}`);

    return new Response(
      JSON.stringify({ url: publicUrlData.publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.log(`Uncaught error: ${msg}`);
    return new Response(
      JSON.stringify({ error: msg, stack: err instanceof Error ? err.stack : undefined }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
