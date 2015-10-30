TLDATE = $(shell wget -qO- http://mirrors.ctan.org/systems/texlive/Source | grep -o 'texlive-[[:digit:]]*-source.tar.xz' | grep -o -m 1 '[[:digit:]]*')
TLDIR = texlive-${TLDATE}-source
TLFILE = texlive-${TLDATE}-source.tar.xz
SHELL=bash


CFG_OPTS_COMMON=\
    --enable-native-texlive-build \
    --enable-static \
    --enable-cxx-runtime-hack \
    --disable-all-pkgs \
    --without-x \
    --without-system-poppler \
    --without-system-freetype2 \
    --without-system-kpathsea \
    --without-system-libpng \
    --without-system-xpdf \
    --without-system-zlib \
    --without-system-teckit \
    --without-system-zziplib \
    --without-system-gd \
    --disable-ptex \
    --disable-largefile \



all: pdftex-worker.js texlive.lst

test:
	makefile_path := $(abspath $(lastword $(MAKEFILE_LIST)))
	cur_dir := $(notdir $(patsubst %/,%,$(dir $(mkfile_path))))

$(TLFILE):
	wget -nc "http://mirrors.ctan.org/systems/texlive/Source/${TLFILE}

$(TLDIR): $(TLFILE)
	rm -rf ${TLDIR}
	tar -xf ${TLFILE}

binary/tangle binary/tie binary/web2c: $(TLDIR)
	rm -rf tmp&&mkdir tmp
	rm -rf binary&&mkdir binary
	cd tmp&&../${TLDIR}/configure -C $(CFG_OPTS_COMMON) --disable-ptex --enable-pdftex
	cd tmp&&make
	cd tmp/texk/web2c&&make pdftex
	cp -rp tmp/texk/web2c/{tangle,tie,web2c} binary/
	rm -rf tmp

.PHONY: tangle tie web2c
tangle tie web2c: binary/tangle binary/tie binary/web2c

libs: $(TLDIR)

build:
	rm -rf build
	mkdir build

build/Makefile: $(TLDIR) | build
	cd build&& \
		CONFIG_SHELL=/bin/bash \
	   	EMCONFIGURE_JS=0 \
		emconfigure ../$(TLDIR)/configure -C $(CFG_OPTS_COMMON) --enable-pdftex CFLAGS=-DELIDE_CODE \
		2>&1|tee configure.log

build/texk/web2c/Makefile: build/Makefile
	cd build&& ax_cv_c_float_words_bigendian=no emconfigure make 2>&1|tee make.log

kpathsea: $(TLDIR)

pdftex.bc: binary/tangle binary/tie binary/web2c  build/texk/web2c/Makefile
	cp -rp binary/{tangle,tie,web2c} build/texk/web2c/
	cd build/texk/web2c && emmake make pdftex  -o tangle -o tie -o web2c -o web2c/makecpool
	opt -strip-debug build/texk/web2c/pdftex >pdftex.bc

pdftex-worker.js: pdftex-pre.js pdftex-post.js pdftex.bc
	OBJFILES=$$(for i in `find build/texk/web2c/lib build/texk/kpathsea -name '*.o'` ; do llvm-nm $$i | grep main >/dev/null || echo $$i ; done) && \
		emcc  --memory-init-file 0 -v --closure 1 -s TOTAL_MEMORY=$$((128*1024*1024)) -O3  pdftex.bc -s INVOKE_RUN=0 --pre-js pdftex-pre.js --post-js pdftex-post.js -o pdftex-worker.js
pdftex: pdftex-worker.js

bibtex.bc:

bibtex-worker.js: bibtex-pre.js bibtex-post.js

bibtex: bibtex-worker.js

install-tl-unx.tar.gz:
	wget http://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz

texlive: install-tl-unx.tar.gz
	rm -rf texlive&&mkdir texlive
	cd texlive && tar xzvf ../install-tl-unx.tar.gz
	echo selected_scheme scheme-basic > texlive/profile.input
	echo TEXDIR `pwd`/texlive >> texlive/profile.input
	echo TEXMFLOCAL `pwd`/texlive/texmf-local >> texlive/profile.input
	echo TEXMFSYSVAR `pwd`/texlive/texmf-var >> texlive/profile.input
	echo TEXMFSYSCONFIG `pwd`/texlive/texmf-config >> texlive/profile.input
	echo TEXMFVAR `pwd`/home/texmf-var >> texlive/profile.input
	echo "Installing Texlive"
	cd texlive && ./install-tl-*/install-tl -profile profile.input
	echo "Removing unnecessary files"
	cd texlive && rm -rf bin readme* tlpkg install* *.html texmf-dist/doc

texlive.lst: texlive
	find texlive -type d -exec echo {}/. \; | sed 's/^texlive//g' >texlive.lst
	find texlive -type f | sed 's/^texlive//g' >>texlive.lst

clean:
	rm -rf tmp
	rm -rf binary
	rm -rf build
	rm -rf texlive-????????-source*
	rm -f install-tl-unx.tar.gz
	rm -f texlive.lst
	rm -f pdftex-worker.js
	rm -f pdftex.bc
	rm -rf texlive

dist:
	rm -rf tmp
	rm -rf binary
	rm -rf build
	rm -rf texlive-????????-source*
	rm -f install-tl-unx.tar.gz
	rm -f pdftex.bc

