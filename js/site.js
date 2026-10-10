// 完成時に、ここだけ書き換えれば運営者情報などに反映されます。
const SITE_BASE = (document.currentScript && document.currentScript.src ? document.currentScript.src.replace(/js\/site\.js.*$/, "") : ""); // サイトのルート（記事ページでも相対パスが崩れないように）
const SITE = {
  url: "https://yamafit.github.io/", // サイトのURL（空のままなら「準備中」と表示）
  contactEmail: "", // 例: "info@example.com"（空のままなら表示しない）
  ga4Id: "",        // GA4の測定ID（例: "G-XXXXXXXXXX"）。空の間はアクセス解析を読み込まない
  formUrl: "",      // お問い合わせの送信先（Formspreeなど、POSTを受けるURL）
  contactFormEmbed: "https://docs.google.com/forms/d/e/1FAIpQLSfvFy4hSFQVu8UjpPLeIzHWq9-jfRqji3tfP2HuQbCtkdDalw/viewform?embedded=true", // Googleフォームの「埋め込み」URL（https://docs.google.com/forms/d/e/…/viewform?embedded=true）。どちらか一方でOK
};

// GA4（測定IDが入っているときだけ読み込む）
if (SITE.ga4Id) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  const g = document.createElement("script");
  g.async = true;
  g.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(SITE.ga4Id);
  document.head.appendChild(g);
  gtag("js", new Date());
  gtag("config", SITE.ga4Id);
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-site=url]").forEach((el) => {
    if (SITE.url) { el.innerHTML = ""; const a = document.createElement("a"); a.href = SITE.url; a.textContent = SITE.url; el.appendChild(a); }
  });
  document.querySelectorAll("[data-site=email-row]").forEach((row) => {
    if (!SITE.contactEmail) return;
    row.hidden = false;
    row.querySelector("dd").textContent = SITE.contactEmail;
  });
  const form = document.getElementById("contact-form");
  if (!form) return;
  const msg = document.getElementById("form-msg");
  const say = (t, ok) => { msg.textContent = t; msg.className = "thanks" + (ok ? "" : " thanks--err"); msg.hidden = false; };
  if (SITE.contactFormEmbed) {
    const f = document.createElement("iframe");
    f.src = SITE.contactFormEmbed; f.title = "お問い合わせフォーム"; f.loading = "lazy";
    f.style.cssText = "width:100%;height:760px;border:0";
    form.replaceWith(f);
    return;
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!SITE.formUrl) { say("現在、フォームの受付を準備しています。しばらくしてからもう一度お試しください。", false); return; }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const r = await fetch(SITE.formUrl, { method: "POST", headers: { Accept: "application/json" }, body: new FormData(form) });
      if (!r.ok) throw new Error(r.status);
      form.reset();
      say("送信ありがとうございました。内容を確認のうえ、3営業日以内にご返信します。", true);
    } catch (err) {
      say("送信できませんでした。時間をおいて、もう一度お試しください。", false);
    } finally { btn.disabled = false; }
  });
});
