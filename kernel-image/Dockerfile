FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    jupyter_kernel_gateway==2.5.2 \
    ipykernel==6.29.5 \
    numpy==2.1.1 \
    pandas==2.2.2 \
    matplotlib==3.9.2 \
    scikit-learn==1.5.2

RUN pip install --no-cache-dir torch==2.4.1 --index-url https://download.pytorch.org/whl/cpu

WORKDIR /workspace

EXPOSE 8888

CMD ["jupyter", "kernelgateway", "--KernelGatewayApp.ip=0.0.0.0", "--KernelGatewayApp.port=8888", "--KernelGatewayApp.allow_origin=*"]
