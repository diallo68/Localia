// Statistiques d'usage des experts d'un modèle à experts (MoE), pour un élagage personnalisé
// (idée de REAP : un expert compte selon son poids de routage et la norme de sa sortie).
// Pour chaque couche et chaque expert : nombre de jetons routés, somme des poids de routage, et
// somme de (poids × norme de la sortie de l'expert). Corpus : fichiers texte, découpés en
// séquences de -c jetons ; le cache est vidé entre deux séquences.
//
// llama-moe-stats -m modele.gguf -c 512 -t 8 --out stats.json fichier1.txt fichier2.txt ...
#include "common.h"
#include "llama.h"
#include "ggml.h"
#include "ggml-backend.h"

#include <cmath>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

struct stats {
    int n_expert = 0;
    std::map<int, std::vector<double>> count, wsum, reap;
    std::map<int, std::vector<int32_t>> topk;  // dernier choix d'experts de la couche
    std::map<int, std::vector<float>> weights; // derniers poids (après normalisation)
    std::map<int, int64_t> n_used;
    int64_t tokens = 0;
    std::vector<uint8_t> buf;
};

static int layer_of(const char * name, const char * prefix) {
    size_t n = strlen(prefix);
    if (strncmp(name, prefix, n) != 0) return -1;
    const char * p = name + n;
    if (*p != '-') return -1;
    return atoi(p + 1);
}

static bool wanted(const char * name) {
    return layer_of(name, "ffn_moe_topk") >= 0 || layer_of(name, "ffn_moe_weights") >= 0 ||
           layer_of(name, "ffn_moe_weights_softmax") >= 0 ||
           layer_of(name, "ffn_moe_weights_norm") >= 0 || layer_of(name, "ffn_moe_down") >= 0;
}

static bool callback(struct ggml_tensor * t, bool ask, void * user) {
    auto * s = (stats *) user;
    if (ask) return wanted(t->name);
    const size_t nb = ggml_nbytes(t);
    s->buf.resize(nb);
    ggml_backend_tensor_get(t, s->buf.data(), 0, nb);
    int il;
    if ((il = layer_of(t->name, "ffn_moe_topk")) >= 0) {
        // [n_expert_used, n_tokens], int32
        const int64_t nu = t->ne[0], nt = t->ne[1];
        s->n_used[il] = nu;
        auto & v = s->topk[il];
        v.resize(nu * nt);
        for (int64_t j = 0; j < nt; j++)
            memcpy(&v[j * nu], s->buf.data() + j * t->nb[1], nu * sizeof(int32_t));
        return true;
    }
    il = layer_of(t->name, "ffn_moe_weights_norm");
    if (il < 0) il = layer_of(t->name, "ffn_moe_weights_softmax");
    if (il < 0) il = layer_of(t->name, "ffn_moe_weights");
    if (il >= 0) {
        // [1, n_expert_used, n_tokens] ou [n_expert_used, n_tokens], f32 : valeurs dans l'ordre
        const int64_t n = ggml_nelements(t);
        auto & v = s->weights[il];
        v.resize(n);
        if (ggml_is_contiguous(t)) memcpy(v.data(), s->buf.data(), n * sizeof(float));
        return true;
    }
    if ((il = layer_of(t->name, "ffn_moe_down")) >= 0) {
        // [n_embd, n_expert_used, n_tokens], f32 : sortie de chaque expert choisi
        const int64_t ne = t->ne[0], nu = t->ne[1], nt = t->ne[2];
        auto & top = s->topk[il];
        auto & w = s->weights[il];
        if ((int64_t) top.size() != nu * nt) return true;
        if (!s->count.count(il)) {
            s->count[il].assign(s->n_expert, 0);
            s->wsum[il].assign(s->n_expert, 0);
            s->reap[il].assign(s->n_expert, 0);
        }
        for (int64_t j = 0; j < nt; j++)
            for (int64_t k = 0; k < nu; k++) {
                const float * out =
                    (const float *) (s->buf.data() + j * t->nb[2] + k * t->nb[1]);
                double norm = 0;
                for (int64_t i = 0; i < ne; i++) norm += (double) out[i] * out[i];
                norm = std::sqrt(norm);
                const int e = top[j * nu + k];
                const double weight = (int64_t) w.size() == nu * nt ? w[j * nu + k] : 1.0;
                if (e < 0 || e >= s->n_expert) continue;
                s->count[il][e] += 1;
                s->wsum[il][e] += weight;
                s->reap[il][e] += weight * norm;
            }
        return true;
    }
    return true;
}

int main(int argc, char ** argv) {
    std::string model_path, out_path = "moe-stats.json";
    int n_ctx = 512, n_threads = 8;
    std::vector<std::string> files;
    for (int i = 1; i < argc; i++) {
        std::string a = argv[i];
        if (a == "-m" && i + 1 < argc) model_path = argv[++i];
        else if (a == "-c" && i + 1 < argc) n_ctx = atoi(argv[++i]);
        else if (a == "-t" && i + 1 < argc) n_threads = atoi(argv[++i]);
        else if (a == "--out" && i + 1 < argc) out_path = argv[++i];
        else files.push_back(a);
    }
    if (model_path.empty() || files.empty()) {
        fprintf(stderr, "usage : llama-moe-stats -m modele.gguf [-c 512] [-t 8] [--out stats.json] textes...\n");
        return 1;
    }
    llama_backend_init();
    auto mp = llama_model_default_params();
    mp.n_gpu_layers = 0;
    llama_model * model = llama_model_load_from_file(model_path.c_str(), mp);
    if (!model) { fprintf(stderr, "modèle illisible\n"); return 1; }

    stats s;
    char buf[64] = {0};
    std::string arch_key = "general.architecture";
    char arch[64] = {0};
    llama_model_meta_val_str(model, arch_key.c_str(), arch, sizeof arch);
    std::string key = std::string(arch) + ".expert_count";
    if (llama_model_meta_val_str(model, key.c_str(), buf, sizeof buf) > 0) s.n_expert = atoi(buf);
    if (s.n_expert <= 0) { fprintf(stderr, "pas un modèle à experts\n"); return 1; }

    auto cp = llama_context_default_params();
    cp.n_ctx = n_ctx;
    cp.n_batch = n_ctx;
    cp.n_ubatch = n_ctx;
    cp.n_threads = cp.n_threads_batch = n_threads;
    cp.cb_eval = callback;
    cp.cb_eval_user_data = &s;
    llama_context * ctx = llama_init_from_model(model, cp);
    const llama_vocab * vocab = llama_model_get_vocab(model);

    int seq = 0;
    for (const auto & f : files) {
        std::ifstream in(f);
        std::stringstream ss;
        ss << in.rdbuf();
        std::string text = ss.str();
        std::vector<llama_token> tokens(text.size() + 16);
        int n = llama_tokenize(vocab, text.c_str(), text.size(), tokens.data(), tokens.size(), true, false);
        if (n < 0) { tokens.resize(-n); n = llama_tokenize(vocab, text.c_str(), text.size(), tokens.data(), tokens.size(), true, false); }
        tokens.resize(n);
        for (int start = 0; start < n; start += n_ctx) {
            int len = std::min(n_ctx, n - start);
            llama_memory_clear(llama_get_memory(ctx), true);
            if (llama_decode(ctx, llama_batch_get_one(tokens.data() + start, len))) {
                fprintf(stderr, "échec du calcul (%s)\n", f.c_str());
                return 1;
            }
            s.tokens += len;
            fprintf(stderr, "\rséquences %d · jetons %lld", ++seq, (long long) s.tokens);
        }
    }
    fprintf(stderr, "\n");

    FILE * out = fopen(out_path.c_str(), "w");
    fprintf(out, "{\"model\":\"%s\",\"tokens\":%lld,\"n_expert\":%d,\"layers\":{", model_path.c_str(), (long long) s.tokens, s.n_expert);
    bool first = true;
    for (auto & [il, c] : s.count) {
        fprintf(out, "%s\"%d\":{\"count\":[", first ? "" : ",", il);
        first = false;
        for (int e = 0; e < s.n_expert; e++) fprintf(out, "%s%.0f", e ? "," : "", c[e]);
        fprintf(out, "],\"wsum\":[");
        for (int e = 0; e < s.n_expert; e++) fprintf(out, "%s%.6g", e ? "," : "", s.wsum[il][e]);
        fprintf(out, "],\"reap\":[");
        for (int e = 0; e < s.n_expert; e++) fprintf(out, "%s%.6g", e ? "," : "", s.reap[il][e]);
        fprintf(out, "]}");
    }
    fprintf(out, "}}\n");
    fclose(out);
    fprintf(stderr, "écrit : %s (%zu couches)\n", out_path.c_str(), s.count.size());
    llama_free(ctx);
    llama_model_free(model);
    llama_backend_free();
    return 0;
}
