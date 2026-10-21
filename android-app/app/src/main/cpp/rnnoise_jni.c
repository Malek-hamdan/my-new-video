#include <jni.h>
#include <stdint.h>
#include "rnnoise.h"

JNIEXPORT jlong JNICALL
Java_com_fieldlog_app_Rnnoise_nativeCreate(JNIEnv *env, jobject thiz) {
    return (jlong) (intptr_t) rnnoise_create(NULL);
}

JNIEXPORT void JNICALL
Java_com_fieldlog_app_Rnnoise_nativeDestroy(JNIEnv *env, jobject thiz, jlong handle) {
    if (handle) rnnoise_destroy((DenoiseState *) (intptr_t) handle);
}

JNIEXPORT jint JNICALL
Java_com_fieldlog_app_Rnnoise_nativeFrameSize(JNIEnv *env, jobject thiz) {
    return rnnoise_get_frame_size();
}

/* in and out are frameSize-length float arrays, scaled to the int16 range. */
JNIEXPORT void JNICALL
Java_com_fieldlog_app_Rnnoise_nativeProcess(JNIEnv *env, jobject thiz, jlong handle,
                                            jfloatArray in, jfloatArray out) {
    jfloat *bi = (*env)->GetFloatArrayElements(env, in, NULL);
    jfloat *bo = (*env)->GetFloatArrayElements(env, out, NULL);
    rnnoise_process_frame((DenoiseState *) (intptr_t) handle, bo, bi);
    (*env)->ReleaseFloatArrayElements(env, in, bi, JNI_ABORT);
    (*env)->ReleaseFloatArrayElements(env, out, bo, 0);
}
