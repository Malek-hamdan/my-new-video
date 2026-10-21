cmake_minimum_required(VERSION 3.22.1)
project(fieldlog_rnnoise C)

set(RNN ${CMAKE_CURRENT_SOURCE_DIR}/rnnoise)

add_library(rnnoise_jni SHARED
    rnnoise_jni.c
    ${RNN}/src/denoise.c
    ${RNN}/src/rnn.c
    ${RNN}/src/pitch.c
    ${RNN}/src/kiss_fft.c
    ${RNN}/src/celt_lpc.c
    ${RNN}/src/nnet.c
    ${RNN}/src/nnet_default.c
    ${RNN}/src/parse_lpcnet_weights.c
    ${RNN}/src/rnnoise_tables.c
    ${RNN}/src/rnnoise_data.c
)

target_include_directories(rnnoise_jni PRIVATE ${RNN}/include ${RNN}/src)
target_compile_options(rnnoise_jni PRIVATE -O2 -fvisibility=hidden -Wno-unused)

find_library(log-lib log)
target_link_libraries(rnnoise_jni ${log-lib} m)
