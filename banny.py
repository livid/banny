import requests
import requests
import json
import base64
import os
import re
import shutil
import time
from urllib.parse import urlparse
import mimetypes
import click
import pylibmc
import crayons


# Initialize memcached client
try:
    mc = pylibmc.Client(
        ["127.0.0.1:11211"],
        binary=True,
        behaviors={"tcp_nodelay": True, "ketama": True},
    )
except Exception:
    mc = None


def get_ens_name_cached(wallet_address, fallback_func):
    """
    Get ENS name for wallet address with 10-minute caching.

    Args:
        wallet_address: The wallet address to resolve
        fallback_func: Function to generate fallback name if ENS fails

    Returns:
        str: ENS name or fallback name
    """
    if mc is None:
        # Memcached not available, make direct request
        return get_ens_name_direct(wallet_address, fallback_func)

    cache_key = f"ens:{wallet_address}"

    try:
        # Try to get from cache first
        cached_name = mc.get(cache_key)
        if cached_name is not None:
            click.echo(f"Cache hit for {wallet_address}: {cached_name}")
            return cached_name
    except Exception as e:
        click.echo(f"Cache read error: {e}", err=True)

    # Cache miss or error, make API request
    name = get_ens_name_direct(wallet_address, fallback_func)

    try:
        # Cache for 30 minutes (1800 seconds)
        mc.set(cache_key, name, time=1800)
        click.echo(f"Cached ENS result for {wallet_address}: {name}")
    except Exception as e:
        click.echo(f"Cache write error: {e}", err=True)

    return name


def get_ens_name_direct(wallet_address, fallback_func):
    """
    Make direct API request to resolve ENS name.

    Args:
        wallet_address: The wallet address to resolve
        fallback_func: Function to generate fallback name if ENS fails

    Returns:
        str: ENS name or fallback name
    """
    ens_url = f"https://api.ensdata.net/{wallet_address}"
    try:
        ens_response = requests.get(ens_url, timeout=10)
        ens_response.raise_for_status()
        ens_data = ens_response.json()
        return ens_data.get("ens", wallet_address)
    except requests.RequestException as e:
        click.echo(f"Failed to resolve ENS for {wallet_address}: {e}", err=True)
        return fallback_func(wallet_address)


def download_and_embed_images_in_svg(svg_filename, keep_bg=False):
    """
    Process an SVG file to find remote image URLs, download them,
    and embed them as base64 data URLs.
    """
    try:
        # Read the SVG file
        with open(svg_filename, "r", encoding="utf-8") as f:
            svg_content = f.read()

        modified = False
        # Debug: Check for mask elements
        if "<g mask='url(#b)'>" in svg_content:
            click.echo(f"DEBUG: Found <g mask='url(#b)'> in {svg_filename}")
            if keep_bg:
                click.echo("Keeping background mask element")
            else:
                click.echo("Removing background mask element")
                # Hide this element if not keeping background
                svg_content = svg_content.replace(
                    "<g mask='url(#b)'>", "<g style='display:none;'>"
                )
                modified = True

        # Find all image tags with href attributes containing URLs
        pattern = r'<image\s+[^>]*href\s*=\s*["\']([^"\']+)["\'][^>]*>'
        matches = re.finditer(pattern, svg_content, re.IGNORECASE)

        for match in matches:
            full_tag = match.group(0)
            image_url = match.group(1)

            # Check if it's a remote URL (not already base64)
            if image_url.startswith(("http://", "https://")):
                click.echo(f"Found remote image URL: {image_url}")

                # Special rule for background Work Station
                if "QmU9uhxuqnVroHrhkzFWH768r9VEsJHJb7nFEPoLT45zwV" in image_url:
                    if not keep_bg:
                        click.echo("Removing background Work Station image")
                        svg_content = svg_content.replace(full_tag, "")
                        click.echo(
                            f"Removed background Work Station image: {image_url}"
                        )
                        modified = True
                        continue
                    else:
                        click.echo("Keeping background Work Station image")

                # Special rule for background Hay Field
                if "QmQiDfFmnANhm4eLqWQBhFEU6Jt5yGayPqNvfBzwJTNUrk" in image_url:
                    if not keep_bg:
                        click.echo("Removing background Hay Field image")
                        svg_content = svg_content.replace(full_tag, "")
                        click.echo(f"Removed background Hay Field image: {image_url}")
                        modified = True
                        continue
                    else:
                        click.echo("Keeping background Hay Field image")

                try:
                    # Download the image
                    response = requests.get(image_url, timeout=30)
                    response.raise_for_status()

                    # Get the content type
                    content_type = response.headers.get("content-type", "")
                    if not content_type:
                        # Try to guess from URL extension
                        parsed_url = urlparse(image_url)
                        content_type, _ = mimetypes.guess_type(parsed_url.path)

                    if not content_type:
                        content_type = "image/png"  # Default fallback

                    # Convert to base64
                    img_b64 = base64.b64encode(response.content)
                    img_b64_str = img_b64.decode("utf-8")
                    data_url = f"data:{content_type};base64,{img_b64_str}"

                    # Replace the URL in the SVG content
                    new_tag = full_tag.replace(image_url, data_url)
                    svg_content = svg_content.replace(full_tag, new_tag)
                    modified = True

                    click.echo(f"Successfully embedded image from {image_url}")

                except requests.RequestException as e:
                    click.echo(
                        f"Failed to download image from {image_url}: {e}", err=True
                    )
                except Exception as e:
                    click.echo(f"Error processing image {image_url}: {e}", err=True)

        # Write back the modified SVG if changes were made
        if modified:
            if not keep_bg:
                svg_filename = svg_filename.replace(".svg", "-transparent.svg")
            else:
                svg_filename = svg_filename.replace(".svg", "-with-bg.svg")
            with open(svg_filename, "w", encoding="utf-8") as f:
                f.write(svg_content)
            click.echo(f"Updated {svg_filename} with embedded images")
        else:
            if not keep_bg:
                svg_filename = svg_filename.replace(".svg", "-transparent.svg")
            else:
                svg_filename = svg_filename.replace(".svg", "-with-bg.svg")
            with open(svg_filename, "w", encoding="utf-8") as f:
                f.write(svg_content)
            click.echo(f"No remote images found in {svg_filename}")

    except Exception as e:
        click.echo(f"Error processing SVG file {svg_filename}: {e}", err=True)


def download_nfts(
    category=0,
    hook="0x2da41cdc79ae49f2725ab549717b2dbcfc42b958",
    limit=100,
    output_width=400,
    output_height=400,
):
    """
    Download and process NFT data from the GraphQL endpoint.

    Args:
        category: NFT category filter
        hook: Hook address filter
        limit: Maximum number of NFTs to fetch
        output_width: Width for PNG conversion
        output_height: Height for PNG conversion
    """
    # Send POST request to GraphQL endpoint
    url = "https://bendystraw.xyz/graphql"
    headers = {"Content-Type": "application/json"}

    # Construct the GraphQL query data
    query_data = {
        "operationName": "NFTs",
        "variables": {
            "where": {"category": category, "hook": hook, "customized": True},
            "limit": limit,
            "orderBy": "customizedAt",
            "orderDirection": "desc",
        },
        "query": """query NFTs($where: nftFilter, $orderBy: String, $orderDirection: String, $limit: Int, $after: String) {
  nfts(
    where: $where
    orderBy: $orderBy
    orderDirection: $orderDirection
    limit: $limit
    after: $after
  ) {
    totalCount
    pageInfo {
      endCursor
      hasNextPage
      __typename
    }
    items {
      chainId
      tokenId
      wallet {
        address
        __typename
      }
      metadata
      category
      tierId
      createdAt
      customized
      customizedAt
      tier {
        ...TierData
        __typename
      }
      __typename
    }
    __typename
  }
}

fragment TierData on nftTier {
  tierId
  price
  encodedIpfsUri
  resolvedUri
  svg
  initialSupply
  remainingSupply
  reserveFrequency
  category
  chainId
  metadata
  __typename
}""",
    }

    try:
        response = requests.post(url, json=query_data, headers=headers)
        response.raise_for_status()
        result = response.json()

        # Process the results
        if (
            "data" in result
            and "nfts" in result["data"]
            and "items" in result["data"]["nfts"]
        ):

            items = result["data"]["nfts"]["items"]
            item_count = len(items)
            click.echo(f"Found {item_count} NFT items")

            # Save items to JSON
            with open("items.json", "w") as f:
                json.dump(items, f, indent=2)
            click.echo("Items saved to items.json")

            # Ensure _work directory exists
            os.makedirs("_work", exist_ok=True)

            # Process each item
            for item in items:
                nft_id = f"{item['chainId']}-{item['tokenId']}"

                if "metadata" in item and "image" in item["metadata"]:
                    image_base64 = item["metadata"]["image"]

                    # Decode the base64 image and save as SVG
                    image_data = image_base64.split(",")[1]
                    decoded_data = base64.b64decode(image_data).decode("utf-8")

                    svg_filename = f"_work/{nft_id}.svg"
                    with open(svg_filename, "wb") as image_file:
                        image_file.write(decoded_data.encode("utf-8"))
                    click.echo(f"Saved image for {nft_id}")

                    # Create backup copy
                    original_svg_filename = f"_work/{nft_id}-original.svg"
                    shutil.copy(svg_filename, original_svg_filename)

                    # Process SVG to embed remote images
                    download_and_embed_images_in_svg(svg_filename, keep_bg=True)
                    download_and_embed_images_in_svg(svg_filename, keep_bg=False)

                    # Convert SVG to PNG using rsvg-convert
                    # Ensure assets/characters directory exists
                    os.makedirs("assets/characters", exist_ok=True)

                    svg_filename_original = svg_filename
                    svg_filename = svg_filename_original.replace(
                        ".svg", "-transparent.svg"
                    )
                    png_filename = f"{nft_id}-transparent.png"
                    convert_command = (
                        f"rsvg-convert -w {output_width} "
                        f"-h {output_height} {svg_filename} "
                        f"-o ./assets/characters/{png_filename}"
                    )
                    os.system(convert_command)

                    svg_filename = svg_filename_original.replace(".svg", "-with-bg.svg")
                    png_filename = f"{nft_id}-with-bg.png"
                    convert_command = (
                        f"rsvg-convert -w {output_width} "
                        f"-h {output_height} {svg_filename} "
                        f"-o ./assets/characters/{png_filename}"
                    )
                    os.system(convert_command)

        else:
            click.echo("No items found in the result")

    except requests.RequestException as e:
        click.echo(f"Error making request: {e}", err=True)
        raise click.Abort()
    except Exception as e:
        click.echo(f"Error processing data: {e}", err=True)
        raise click.Abort()


@click.group()
def cli():
    """NFT processing tool for Banny game."""
    pass


@cli.command()
@click.option("--category", default=0, help="NFT category filter")
@click.option(
    "--hook",
    default="0x2da41cdc79ae49f2725ab549717b2dbcfc42b958",
    help="Hook address filter",
)
@click.option("--limit", default=100, help="Maximum number of NFTs to fetch")
@click.option("--width", default=400, help="Output PNG width")
@click.option("--height", default=400, help="Output PNG height")
def download(category, hook, limit, width, height):
    """
    Download and process banny NFT for the banny game.

    This tool fetches NFT data, saves SVG images, embeds remote images,
    and converts them to PNG format.
    """
    click.echo("Starting NFT download and processing...")
    download_nfts(category, hook, limit, width, height)
    click.echo("Processing complete!")


def short_wallet_address(address):
    return f"{address[:6]}...{address[-4:]}"


@cli.command()
def convert():
    """Convert and process items from items.json"""
    start_time = time.time()

    # load item.json as a dictionary
    with open("items.json", "r") as f:
        items = json.load(f)

    if not items:
        click.echo("No items found in items.json")
        return
    click.echo(f"Processing {len(items)} items from items.json")

    characters = []
    for item in items:
        character = {}
        # base stats
        character["fireRate"] = 500
        character["bigBoom"] = 0
        character["boomerang"] = 0
        character["health"] = 100
        character["regen"] = 0

        character["nft_id"] = f"{item['chainId']}-{item['tokenId']}"
        wallet_address = item["wallet"]["address"]
        image_name = f"{character['nft_id']}-transparent.png"
        image_selection_name = f"{character['nft_id']}-with-bg.png"
        character["image"] = image_name
        character["imageSelection"] = image_selection_name
        # resolve wallet address with ensdata.net
        character["name"] = get_ens_name_cached(wallet_address, short_wallet_address)

        print("------------------------------")

        print(f"Processing character: {character['name']} ({character['nft_id']})")
        print()
        print(f"{character['name']} has:")
        print()

        # Print attributes in the requested format
        if "metadata" in item and "attributes" in item["metadata"]:
            character["health"] = 0
            for attribute in item["metadata"]["attributes"]:
                print(f"- {attribute['trait_type']} -> {attribute['value']}")

                trait_type = attribute["trait_type"].lower()
                value = attribute["value"].lower()

                # rule 1: banny product name (original, orange, pink, alien) determines health
                if trait_type == "product name":
                    if value == "original":
                        character["health"] += 100
                        click.echo(
                            crayons.yellow(
                                f"+ Set health to {character['health']} for original product"
                            )
                        )
                    elif value == "orange":
                        character["health"] += 150
                        click.echo(
                            crayons.red(
                                f"+ Set health to {character['health']} for orange product"
                            )
                        )
                    elif value == "pink":
                        character["health"] += 200
                        click.echo(
                            crayons.magenta(
                                f"+ Set health to {character['health']} for pink product"
                            )
                        )
                    elif value == "alien":
                        character["health"] += 500
                        click.echo(
                            crayons.green(
                                f"+ Set health to {character['health']} for alien product"
                            )
                        )

                # rule 2: pew pew gives 200ms fire rate
                if value == "pew pew":
                    character["fireRate"] = 200
                    click.echo(
                        crayons.green(
                            f"+ Reduced fire rate to {character['fireRate']}ms due to pew pew"
                        )
                    )

                # rule 3: dagger reduce 50ms fire rate
                if value == "dagger":
                    character["fireRate"] = max(100, character["fireRate"] - 50)
                    click.echo(
                        crayons.green(
                            f"+ Reduced fire rate to {character['fireRate']}ms due to dagger"
                        )
                    )

                # rule 4: punk jacket add 69 health, 1 bigBoom, slow fire rate +150ms
                if value == "punk jacket":
                    character["health"] += 69
                    click.echo(
                        crayons.green(
                            f"+ Increased health to {character['health']} due to punk jacket"
                        )
                    )
                    character["bigBoom"] += 1
                    click.echo(crayons.green("+ Add 1 bigBoom due to punk jacket"))
                    character["fireRate"] += 150
                    click.echo(
                        crayons.green(
                            f"+ Increased fire rate to {character['fireRate']}ms due to punk jacket"
                        )
                    )

                # rule 5: doc coat add 50 health, and 0.5 regen
                if value == "doc coat":
                    character["health"] += 50
                    click.echo(
                        crayons.green(
                            f"+ Increased health to {character['health']} due to doc coat"
                        )
                    )
                    character["regen"] += 0.5
                    click.echo(
                        crayons.green(
                            f"+ Added 0.5 regen, total regen: {character['regen']}"
                        )
                    )

                # rule 6: constitution adds 1 boomerang
                if value == "constitution":
                    character["boomerang"] += 1
                    click.echo(
                        crayons.green(
                            f"+ Added 1 boomerang, total boomerangs: {character['boomerang']}"
                        )
                    )

        print()  # Add empty line between characters
        characters.append(character)

    # Save characters to JSON
    with open("characters.json", "w") as f:
        json.dump(characters, f, indent=2)
    click.echo("Characters saved to characters.json")

    end_time = time.time()
    execution_time = end_time - start_time
    click.echo(f"Convert command completed in {execution_time:.2f} seconds")


if __name__ == "__main__":
    cli()
